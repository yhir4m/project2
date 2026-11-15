import "server-only";
import {
  calcularDescuento,
  centavosAPesos,
  construirTicket,
  montoACobrar,
  numRefDesdeId,
  pesosACentavos,
  type Compra,
  type Ticket,
} from "@cdv/core";
import type { Perfil, Transaccion } from "@cdv/db";
import { confirmarPago, PeyError, verificarWebhook, type TransaccionPey } from "@cdv/pey";
import { ctx, registrarProcesadorWebhook } from "./contexto";
import { env } from "./env";
import { leerVerificacion } from "./escaneo";
import { ErrorHttp } from "./sesion";

/** Pey exige expiración ≥ 360 s en /codi/pn y /codi/qr. */
export const EXPIRACION_COBRO_SEG = 360;

async function contextoCobro(token: string, comercioId: string) {
  const { repo } = ctx();
  const v = await leerVerificacion(token, comercioId);
  const [cred, convenio] = await Promise.all([repo.credencial(v.cid), repo.convenio(v.cnv)]);
  // Se re-verifica la revocación al cobrar (pudo revocarse después del escaneo).
  if (!cred || cred.estado !== "activa" || cred.vigente_hasta.getTime() <= Date.now()) {
    throw new ErrorHttp(409, "credencial_no_vigente", "La credencial ya no está vigente.");
  }
  if (!convenio || !convenio.activo) throw new ErrorHttp(409, "convenio_inactivo", "El convenio ya no está activo.");
  return { v, cred, convenio };
}

/** Vista previa del descuento. Se calcula SIEMPRE en el servidor. */
export async function cotizar(token: string, comercioId: string, compra: Compra) {
  const { cred, convenio } = await contextoCobro(token, comercioId);
  const usos = await ctx().repo.usosHoy(cred.id, convenio.id);
  return calcularDescuento({ regla: convenio.regla, compra, usos_hoy: usos });
}

export async function crearCobro(args: {
  token: string;
  comercioId: string;
  compra: Compra;
  metodo: "codi" | "efectivo";
}): Promise<Transaccion> {
  const { repo, pey } = ctx();
  const e = env();
  const { v, cred, convenio } = await contextoCobro(args.token, args.comercioId);

  // Idempotencia: una verificación (nonce del QR) → como máximo una transacción.
  const previa = await repo.transaccionPorIdempotencia(v.jti);
  if (previa) return previa;

  const usos = await repo.usosHoy(cred.id, convenio.id);
  const calc = calcularDescuento({ regla: convenio.regla, compra: args.compra, usos_hoy: usos });

  const beneficiario = await repo.perfil(cred.usuario_id);
  const canal = args.metodo === "codi" ? (beneficiario?.celular ? "pn" : "qr") : null;
  if (args.metodo === "codi" && calc.monto_final_centavos === 0) {
    throw new ErrorHttp(422, "monto_cero", "El total con descuento es $0. Registra la venta en efectivo.");
  }
  const cobrado =
    args.metodo === "codi"
      ? montoACobrar({
          montoFinalCentavos: calc.monto_final_centavos,
          modoPrueba: e.MODO_PRUEBA,
          montoPruebaCentavos: pesosACentavos(e.MONTO_PRUEBA_MXN),
        })
      : calc.monto_final_centavos;

  const { transaccion: tx, creada } = await repo.crearTransaccion({
    idempotency_key: v.jti,
    comercio_id: args.comercioId,
    credencial_id: cred.id,
    convenio_id: convenio.id,
    compra: args.compra,
    precio_original_centavos: calc.precio_original_centavos,
    descuento_centavos: calc.descuento_centavos,
    monto_final_centavos: calc.monto_final_centavos,
    monto_cobrado_centavos: cobrado,
    metodo: args.metodo,
    canal,
    modo_prueba: args.metodo === "codi" && e.MODO_PRUEBA,
  });
  if (!creada) return tx;

  // ---- Efectivo: la validación y el descuento aplican igual; se registra al momento.
  if (args.metodo === "efectivo") {
    const pagada = await repo.transicionarTransaccion(tx.id, ["creando"], { estado: "pagada", pagada_en: new Date() });
    await notificarPago(pagada!);
    return pagada!;
  }

  // ---- CoDi: crear el cobro en Pey. Un POST nunca se reintenta a ciegas.
  const comercio = await repo.comercio(args.comercioId);
  const concepto = `${convenio.nombre} - ${comercio?.nombre ?? "Comercio"}`.slice(0, 120);
  const numRef = numRefDesdeId(tx.id);
  const comun = {
    amount: centavosAPesos(cobrado),
    concept: concepto,
    expiration: EXPIRACION_COBRO_SEG,
    numRef,
    ...(comercio?.pey_bank_account_id ? { bankAccountId: comercio.pey_bank_account_id } : {}),
    metadata: { txId: tx.id, modoPrueba: e.MODO_PRUEBA },
  };
  const expira = new Date(Date.now() + EXPIRACION_COBRO_SEG * 1000);

  try {
    if (canal === "pn") {
      const r = await pey.crearPushNotification({ ...comun, phoneNumber: beneficiario!.celular! });
      return (await repo.transicionarTransaccion(tx.id, ["creando"], {
        estado: "pendiente",
        pey_id: r.transactionId,
        pey_codi_id: r.codiId,
        pey_num_ref: numRef,
        expira_en: expira,
      }))!;
    }
    const r = await pey.crearQr(comun);
    return (await repo.transicionarTransaccion(tx.id, ["creando"], {
      estado: "pendiente",
      pey_codi_id: r.id,
      pey_qr_string: r.qrString,
      pey_num_ref: numRef,
      expira_en: expira,
    }))!;
  } catch (err) {
    const incierto = err instanceof PeyError ? err.incierto : true;
    const msg = err instanceof Error ? err.message : "Error desconocido";
    await repo.transicionarTransaccion(tx.id, ["creando"], {
      estado: incierto ? "incierta" : "fallida",
      error: msg.slice(0, 300),
      expira_en: expira,
    });
    if (incierto) {
      throw new ErrorHttp(502, "cobro_incierto", "No confirmamos si el cobro se envió. Revisa en unos segundos antes de reintentar.");
    }
    throw new ErrorHttp(502, "cobro_fallido", "El sistema de pagos rechazó el cobro. Intenta de nuevo o cobra en efectivo.");
  }
}

// ---------------------------------------------------------------------------
// Confirmación: webhook (aviso) → GET /transaction (prueba) → pagada
// ---------------------------------------------------------------------------

async function confirmarConPey(tx: Transaccion, peyTx: TransaccionPey): Promise<Transaccion | null> {
  const { repo } = ctx();
  const r = confirmarPago(peyTx, { montoCentavos: tx.monto_cobrado_centavos, txId: tx.id, canal: tx.canal ?? "pn" });
  if (!r.ok) {
    if (r.error === "no_pagada") return null;
    // Pago con datos que no cuadran: no se marca pagada; queda registrado para revisión.
    console.error("[cobro] Pago no coincide", tx.id, r.error);
    await repo.transicionarTransaccion(tx.id, ["pendiente", "incierta", "expirada", "creando"], {
      error: `confirmacion:${r.error}`,
    });
    return null;
  }
  const pagada = await repo.transicionarTransaccion(tx.id, ["creando", "pendiente", "incierta", "expirada", "cancelada"], {
    estado: "pagada",
    pey_id: peyTx.id,
    pagada_en: peyTx.datePaid ? new Date(peyTx.datePaid * 1000) : new Date(),
    error: null,
  });
  if (pagada) await notificarPago(pagada);
  return pagada;
}

/** Procesa un webhook de Pey a partir del CUERPO CRUDO. Idempotente por `webhook-id`. */
export async function procesarWebhook(
  cuerpoCrudo: string,
  encabezados: Headers | Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { repo, pey, webhookSecret } = ctx();
  const v = verificarWebhook(cuerpoCrudo, encabezados, webhookSecret);
  if (!v.ok) return { status: v.error === "payload_invalido" ? 400 : 401, body: { error: v.error } };

  const nuevo = await repo.registrarWebhook({ id: v.webhookId, tipo: v.evento ? v.evento.type : "tipo" in v ? v.tipo : "desconocido", payload: JSON.parse(cuerpoCrudo) });
  if (!nuevo) {
    const previo = await repo.webhook(v.webhookId);
    if (previo?.procesado) return { status: 200, body: { duplicado: true } };
  }
  if (!v.evento) {
    await repo.marcarWebhook(v.webhookId, { procesado: true, procesado_at: new Date() });
    return { status: 200, body: { ignorado: true } };
  }

  const ev = v.evento;
  const tx =
    (await repo.transaccionPorPeyId(ev.transactionId)) ??
    (ev.type === "codi.qr.payment_received" ? await repo.transaccionPorCodiId(ev.codiQrId) : null) ??
    (ev.metadata?.externalMetadata?.txId ? await repo.transaccion(ev.metadata.externalMetadata.txId) : null);
  if (!tx) {
    await repo.marcarWebhook(v.webhookId, { error: "transaccion_no_encontrada" });
    // 200 para no provocar reintentos infinitos; queda en la bitácora para conciliación.
    return { status: 200, body: { sin_transaccion: true } };
  }
  if (tx.estado === "pagada") {
    await repo.marcarWebhook(v.webhookId, { procesado: true, procesado_at: new Date(), transaccion_id: tx.id });
    return { status: 200, body: { ya_pagada: true } };
  }

  // El webhook es AVISO: la prueba es la transacción consultada en la API.
  const peyTx = await pey.obtenerTransaccion(ev.transactionId);
  const pagada = await confirmarConPey(tx, peyTx);
  await repo.marcarWebhook(v.webhookId, {
    procesado: Boolean(pagada),
    procesado_at: pagada ? new Date() : null,
    transaccion_id: tx.id,
    error: pagada ? null : "no_confirmada",
  });
  return { status: 200, body: { confirmada: Boolean(pagada) } };
}
registrarProcesadorWebhook(async (cuerpo, h) => {
  await procesarWebhook(cuerpo, h);
});

/**
 * Al consultar una transacción vencida o incierta se concilia una vez con Pey
 * (no hay webhooks de expiración ni rechazo en Pey).
 */
export async function refrescarTransaccion(tx: Transaccion): Promise<Transaccion> {
  const { repo, pey } = ctx();
  const vencida = tx.expira_en && tx.expira_en.getTime() < Date.now();
  if (!(tx.estado === "incierta" || (tx.estado === "pendiente" && vencida))) return tx;
  try {
    const peyTx = tx.pey_id ? await pey.obtenerTransaccion(tx.pey_id) : await pey.buscarPorTxId(tx.id);
    if (peyTx) {
      const pagada = await confirmarConPey(tx, peyTx);
      if (pagada) return pagada;
      if (tx.estado === "incierta" && peyTx.status === "PENDING" && !vencida) {
        return (await repo.transicionarTransaccion(tx.id, ["incierta"], { estado: "pendiente", pey_id: peyTx.id })) ?? tx;
      }
    }
  } catch (e) {
    console.warn("[conciliación]", tx.id, e instanceof Error ? e.message : e);
    return tx;
  }
  if (vencida) return (await repo.transicionarTransaccion(tx.id, ["pendiente", "incierta"], { estado: "expirada" })) ?? tx;
  return tx;
}

export async function cancelarCobro(txId: string, comercioId: string) {
  const { repo } = ctx();
  const tx = await repo.transaccion(txId);
  if (!tx || tx.comercio_id !== comercioId) throw new ErrorHttp(404, "no_encontrada", "No encontramos el cobro.");
  // Nota: Pey no documenta cancelación; si el pagador autoriza después, el webhook la marcará pagada.
  return (await repo.transicionarTransaccion(tx.id, ["pendiente", "incierta", "creando"], { estado: "cancelada" })) ?? tx;
}

async function notificarPago(tx: Transaccion) {
  const { repo } = ctx();
  const [cred, comercio, convenio] = await Promise.all([
    repo.credencial(tx.credencial_id),
    repo.comercio(tx.comercio_id),
    repo.convenio(tx.convenio_id),
  ]);
  if (!cred) return;
  const t = ticketDe(tx, comercio?.nombre ?? "Comercio", convenio?.nombre ?? "Convenio");
  await repo.notificar({
    usuario_id: cred.usuario_id,
    tipo: "pago_confirmado",
    titulo: `Pagaste ${t.monto_pagado} en ${t.comercio}`,
    cuerpo: `Ahorraste ${t.descuento} con ${t.convenio}.`,
    datos: { transaccion_id: tx.id },
  });
}

export function ticketDe(tx: Transaccion, comercio: string, convenio: string): Ticket {
  return construirTicket({
    id: tx.id,
    comercio,
    convenio,
    precioOriginal: tx.precio_original_centavos,
    descuento: tx.descuento_centavos,
    montoFinal: tx.monto_final_centavos,
    montoCobrado: tx.monto_cobrado_centavos,
    metodo: tx.metodo,
    pagadaEn: tx.pagada_en ?? tx.created_at,
    peyId: tx.pey_id,
    modoPrueba: tx.modo_prueba,
  });
}

/** Vista de la transacción según quién la ve (el comercio nunca ve datos del beneficiario). */
export async function vistaTransaccion(tx: Transaccion, para: Perfil) {
  const { repo } = ctx();
  const [comercio, convenio] = await Promise.all([repo.comercio(tx.comercio_id), repo.convenio(tx.convenio_id)]);
  return {
    id: tx.id,
    estado: tx.estado,
    metodo: tx.metodo,
    canal: tx.canal,
    comercio: comercio?.nombre ?? "Comercio",
    convenio: convenio?.nombre ?? "Convenio",
    precio_original_centavos: tx.precio_original_centavos,
    descuento_centavos: tx.descuento_centavos,
    monto_final_centavos: tx.monto_final_centavos,
    monto_cobrado_centavos: tx.monto_cobrado_centavos,
    modo_prueba: tx.modo_prueba,
    compra: tx.compra,
    expira_en: tx.expira_en?.toISOString() ?? null,
    pagada_en: tx.pagada_en?.toISOString() ?? null,
    created_at: tx.created_at.toISOString(),
    pey_id: tx.pey_id,
    // QR de cobro solo para el comercio (se muestra en su pantalla).
    qr_cobro: para.rol === "comercio" ? tx.pey_qr_string : null,
    ticket: tx.estado === "pagada" ? ticketDe(tx, comercio?.nombre ?? "Comercio", convenio?.nombre ?? "Convenio") : null,
    simulado: env().PEY_SIMULADO,
  };
}
export type VistaTransaccion = Awaited<ReturnType<typeof vistaTransaccion>>;

export async function puedeVerTransaccion(tx: Transaccion, u: Perfil): Promise<boolean> {
  if (u.rol === "comercio") return tx.comercio_id === u.comercio_id;
  if (u.rol === "beneficiario") {
    const c = await ctx().repo.credencial(tx.credencial_id);
    return c?.usuario_id === u.id;
  }
  return false;
}
