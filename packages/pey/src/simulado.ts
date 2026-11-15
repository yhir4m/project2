import { Webhook } from "standardwebhooks";
import type { PeyClient } from "./client";
import type {
  CrearPushNotification,
  CrearQr,
  PushNotificationRespuesta,
  QrRespuesta,
  TransaccionPey,
} from "./schemas";
import { CrearPushNotificationSchema, CrearQrSchema } from "./schemas";

/** Lo que la app necesita de Pey. Lo implementan `PeyClient` (real) y `PeySimulado` (sin red). */
export type ClientePey = Pick<
  PeyClient,
  "crearPushNotification" | "crearQr" | "obtenerTransaccion" | "buscarPorTxId"
>;

/** Entrega un webhook firmado al receptor (en la app: la misma función que atiende /api/webhooks/pey). */
export type EntregarWebhook = (
  cuerpoCrudo: string,
  encabezados: Record<string, string>,
) => Promise<void>;

interface Pendiente {
  tx: TransaccionPey;
  canal: "pn" | "qr";
  codiQrId?: string;
}

/**
 * Simulador de Pey para desarrollo y demo sin API key: respeta las mismas validaciones
 * (celular de 10 dígitos, expiración ≥ 360 s, etc.) y, al "autorizar" un pago, envía un
 * webhook FIRMADO con Standard Webhooks para recorrer exactamente el mismo camino que producción.
 */
export class PeySimulado implements ClientePey {
  private txs = new Map<string, Pendiente>();
  private porQr = new Map<string, string>();
  private seq = 0;

  constructor(
    private readonly secretoWebhook: string,
    private readonly entregar: EntregarWebhook,
  ) {}

  async crearPushNotification(input: CrearPushNotification): Promise<PushNotificationRespuesta> {
    const p = CrearPushNotificationSchema.parse(input);
    const id = this.ulid();
    this.txs.set(id, {
      canal: "pn",
      tx: this.nueva(id, p.amount, "API_CODI_PN", p.concept, p.metadata),
    });
    return { transactionId: id, codiId: String(Date.now()).padStart(20, "0") };
  }

  async crearQr(input: CrearQr): Promise<QrRespuesta> {
    const p = CrearQrSchema.parse(input);
    const id = this.ulid();
    const codiQrId = Math.random().toString(16).slice(2, 12);
    this.txs.set(id, {
      canal: "qr",
      codiQrId,
      tx: this.nueva(id, p.amount, "API_CODI_QR", p.concept, p.metadata),
    });
    this.porQr.set(codiQrId, id);
    return {
      id: codiQrId,
      // No es un QR CoDi real: solo sirve para la demo.
      qrString: JSON.stringify({
        TYP: 20,
        v: { DEV: "SIMULADO" },
        ic: { IDC: codiQrId, MONTO: p.amount },
      }),
      qrImage: null,
    };
  }

  async obtenerTransaccion(id: string): Promise<TransaccionPey> {
    const t = this.txs.get(id);
    if (!t) throw Object.assign(new Error("Transaction not found"), { status: 404 });
    return structuredClone(t.tx);
  }

  async buscarPorTxId(txId: string): Promise<TransaccionPey | null> {
    for (const { tx } of this.txs.values())
      if (tx.metadata?.externalMetadata?.txId === txId) return structuredClone(tx);
    return null;
  }

  /** Simula que el pagador autoriza en su app bancaria. Para canal QR se busca por IDC. */
  async autorizar(args: { transactionId?: string; codiQrId?: string }): Promise<void> {
    const id = args.transactionId ?? (args.codiQrId ? this.porQr.get(args.codiQrId) : undefined);
    const p = id ? this.txs.get(id) : undefined;
    if (!p) throw new Error("Cobro simulado no encontrado");
    if (p.tx.status === "PAID") return;
    const ahora = Math.floor(Date.now() / 1000);
    p.tx.status = "PAID";
    p.tx.datePaid = ahora;

    const evento = {
      type: p.canal === "pn" ? "codi.pn.payment_received" : "codi.qr.payment_received",
      transactionId: p.tx.id,
      amount: p.tx.amount,
      apiKeyId: "SIMULADO",
      concept: p.tx.description,
      datePaid: ahora,
      numRef: "0",
      ...(p.codiQrId ? { codiQrId: p.codiQrId } : {}),
      metadata: { ...p.tx.metadata, trackingKey: "SIM" + ahora },
    };
    const cuerpo = JSON.stringify(evento);
    const msgId = `msg_sim_${p.tx.id}`;
    const fecha = new Date();
    const firma = new Webhook(this.secretoWebhook).sign(msgId, fecha, cuerpo);
    await this.entregar(cuerpo, {
      "webhook-id": msgId,
      "webhook-timestamp": String(Math.floor(fecha.getTime() / 1000)),
      "webhook-signature": firma,
    });
  }

  private nueva(
    id: string,
    amount: number,
    payableType: "API_CODI_PN" | "API_CODI_QR",
    concept: string | undefined,
    metadata: Record<string, unknown> | undefined,
  ): TransaccionPey {
    const ext = metadata
      ? Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)]))
      : undefined;
    return {
      id,
      status: "PENDING",
      amount,
      amountBreakdown: { base: amount, tip: 0, fee: 0 },
      currency: "MXN",
      paymentMethod: "CODI",
      payableType,
      description: concept,
      dateCreated: Math.floor(Date.now() / 1000),
      metadata: ext ? { externalMetadata: ext } : {},
    };
  }

  private ulid(): string {
    return ("01SIM" + Date.now().toString(36) + (++this.seq).toString(36))
      .toUpperCase()
      .padEnd(26, "0")
      .slice(0, 26);
  }
}
