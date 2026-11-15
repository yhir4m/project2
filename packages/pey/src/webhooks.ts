import { Webhook, WebhookVerificationError } from "standardwebhooks";
import {
  WebhookEventoSchema,
  TIPOS_EVENTO_SOPORTADOS,
  type TransaccionPey,
  type WebhookEvento,
} from "./schemas";

export type ResultadoWebhook =
  | { ok: true; webhookId: string; evento: WebhookEvento }
  | { ok: true; webhookId: string; evento: null; tipo: string } // firmado, pero de un tipo que no usamos
  | { ok: false; error: "faltan_encabezados" | "firma_invalida" | "payload_invalido" };

/**
 * Verifica un webhook de Pey (Standard Webhooks).
 * IMPORTANTE: `cuerpoCrudo` debe ser el texto EXACTO recibido (`await req.text()`), nunca JSON re-serializado.
 */
export function verificarWebhook(
  cuerpoCrudo: string,
  encabezados: Headers | Record<string, string | null | undefined>,
  secreto: string,
): ResultadoWebhook {
  const get = (k: string) =>
    (encabezados instanceof Headers ? encabezados.get(k) : encabezados[k]) ?? null;
  const id = get("webhook-id");
  const ts = get("webhook-timestamp");
  const sig = get("webhook-signature");
  if (!id || !ts || !sig) return { ok: false, error: "faltan_encabezados" };

  let payload: unknown;
  try {
    payload = new Webhook(secreto).verify(cuerpoCrudo, {
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": sig,
    });
  } catch (e) {
    if (e instanceof WebhookVerificationError) return { ok: false, error: "firma_invalida" };
    return { ok: false, error: "firma_invalida" };
  }

  const tipo = (payload as { type?: unknown } | null)?.type;
  if (typeof tipo === "string" && !(TIPOS_EVENTO_SOPORTADOS as readonly string[]).includes(tipo)) {
    return { ok: true, webhookId: id, evento: null, tipo };
  }
  const parsed = WebhookEventoSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "payload_invalido" };
  return { ok: true, webhookId: id, evento: parsed.data };
}

export type ErrorConfirmacion =
  | "no_pagada"
  | "metodo_incorrecto"
  | "moneda_incorrecta"
  | "monto_no_coincide"
  | "referencia_no_coincide";

/**
 * El webhook es un AVISO; la PRUEBA es la transacción consultada en la API.
 * Compara contra el monto que esperamos cobrar (en centavos). Usa `amountBreakdown.base` si existe,
 * porque `amount` puede incluir la comisión (ver docs/PEY.md §2.3, pendiente P2).
 */
export function confirmarPago(
  tx: TransaccionPey,
  esperado: { montoCentavos: number; txId: string; canal: "pn" | "qr" },
): { ok: true; montoCentavos: number } | { ok: false; error: ErrorConfirmacion } {
  if (tx.status !== "PAID") return { ok: false, error: "no_pagada" };
  if (tx.paymentMethod && tx.paymentMethod !== "CODI")
    return { ok: false, error: "metodo_incorrecto" };
  const tipoEsperado = esperado.canal === "pn" ? "API_CODI_PN" : "API_CODI_QR";
  if (tx.payableType && tx.payableType !== tipoEsperado)
    return { ok: false, error: "metodo_incorrecto" };
  if (tx.currency && tx.currency.toUpperCase() !== "MXN")
    return { ok: false, error: "moneda_incorrecta" };

  const ref = tx.metadata?.externalMetadata?.txId;
  if (ref !== undefined && ref !== esperado.txId)
    return { ok: false, error: "referencia_no_coincide" };

  const base = tx.amountBreakdown?.base ?? tx.amount;
  const recibido = Math.round(base * 100);
  if (recibido !== esperado.montoCentavos) return { ok: false, error: "monto_no_coincide" };
  return { ok: true, montoCentavos: recibido };
}
