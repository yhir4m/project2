import "server-only";
import {
  calcularDescuento,
  centavosAPesos,
  construirTicket,
  describirRegla,
  firmarCobro,
  leerCobro,
  MENSAJES_ERROR_COBRO,
  montoACobrar,
  numRefDesdeId,
  pesosACentavos,
  totalCompra,
  COBRO_TTL_SEGUNDOS,
  type Compra,
  type ResultadoDescuento,
  type Ticket,
} from "@cdv/core";
import type { Convenio, Credencial, Perfil, SolicitudCobro, Transaccion } from "@cdv/db";
import { confirmarPago, PeyError, verificarWebhook, type TransaccionPey } from "@cdv/pey";
import { ctx, registrarProcesadorWebhook } from "./contexto";
import { validarCredencialParaPago } from "./credenciales";
import { env } from "./env";
import { ErrorHttp, type UsuarioSesion } from "./sesion";

/** Pey exige expiración ≥ 360 s en /codi/pn. */
export const EXPIRACION_COBRO_SEG = 360;

// ===========================================================================
// 1. El COMERCIO genera la solicitud de cobro (QR en su pantalla)
// ===========================================================================

export async function crearSolicitud(comercioId: string, compra: Compra) {
  const total = totalCompra(compra);
  return ctx().repo.crearSolicitud({
    comercio_id: comercioId,
    compra,
    total_centavos: total,
    expira_en: new Date(Date.now() + COBRO_TTL_SEGUNDOS * 1000),
  });
}

export async function qrDeSolicitud(s: SolicitudCobro): Promise<string | null> {
  if (s.estado !== "abierta" || s.expira_en.getTime() <= Date.now()) return null;
  return firmarCobro({ solicitudId: s.id, comercioId: s.comercio_id, expiraEn: s.expira_en }, ctx().verificacionKey);
}

export async function solicitudDeComercio(id: string, comercioId: string) {
  const s = await ctx().repo.solicitud(id);
  if (!s || s.comercio_id !== comercioId) throw new ErrorHttp(404, "no_encontrada", "No encontramos este cobro.");
  // Expiración perezosa.
  if (s.estado === "abierta" && s.expira_en.getTime() <= Date.now()) {
    return (await ctx().repo.actualizarSolicitud(s.id, ["abierta"], { estado: "expirada" })) ?? s;
  }
  return s;
}

export async function cancelarSolicitud(id: string, comercioId: string) {
  const { repo } = ctx();
  const s = await solicitudDeComercio(id, comercioId);
  if (s.transaccion_id) {
    // Pey no documenta cancelación de un cobro CoDi enviado: si el cliente autoriza después, el webhook lo marcará pagado.
    await repo.transicionarTransaccion(s.transaccion_id, ["pendiente", "incierta", "creando"], { estado: "cancelada" });
  }
  return (await repo.actualizarSolicitud(s.id, ["abierta", "tomada"], { estado: "cancelada" })) ?? s;
}

/** Pago en efectivo: el comercio confirma que recibió el dinero. */
export async function confirmarEfectivo(id: string, comercioId: string) {
  const { repo } = ctx();
  const s = await solicitudDeComercio(id, comercioId);
  if (!s.transaccion_id) throw new ErrorHttp(409, "sin_cliente", "El cliente aún no ha escaneado el código.");
  const tx = await repo.transaccion(s.transaccion_id);
  if (!tx || tx.metodo !== "efectivo") throw new ErrorHttp(409, "no_es_efectivo", "Este cobro no es en efectivo.");
  const pagada = await repo.transicionarTransaccion(tx.id, ["pendiente"], { estado: "pagada", pagada_en: new Date() });
  if (pagada) await alPagar(pagada);
  return pagada ?? tx;
}

// ===========================================================================
// 2. El CLIENTE escanea el QR del comercio
// ===========================================================================

async function solicitudDesdeQr(contenido: string) {
  const r = await leerCobro(contenido, ctx().verificacionKey);
  if (!r.ok) throw new ErrorHttp(422, r.error, MENSAJES_ERROR_COBRO[r.error]);
  const s = await ctx().repo.solicitud(r.claims.sid);
  if (!s || s.comercio_id !== r.claims.com) throw new ErrorHttp(422, "firma_invalida", MENSAJES_ERROR_COBRO.firma_invalida);
  if (s.estado !== "abierta") {
    throw new ErrorHttp(409, "solicitud_no_disponible", "Este cobro ya fue pagado o cancelado. Pide uno nuevo al negocio.");
  }
  if (s.expira_en.getTime() <= Date.now()) throw new ErrorHttp(410, "expirado", MENSAJES_ERROR_COBRO.expirado);
  return s;
}

interface OpcionDescuento {
  credencial: Credencial;
  convenio: Convenio;
  calculo: ResultadoDescuento;
}

/** Fecha de hoy en CDMX (YYYY-MM-DD) para comparar vigencias de convenios. */
function hoyCdmx() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

/**
 * Credenciales del usuario que aplican en ese comercio. Si una credencial tiene varios convenios
 * en el mismo comercio (p. ej. 10 % general y 20 % en café), se aplica el que más le ahorra.
 * Resultado ordenado: mejor descuento primero.
 */
async function opcionesDescuento(usuarioId: string, s: SolicitudCobro): Promise<OpcionDescuento[]> {
  const { repo } = ctx();
  const hoy = hoyCdmx();
  const [creds, conveniosComercio] = await Promise.all([
    repo.credencialesDeUsuario(usuarioId),
    repo.conveniosDeComercio(s.comercio_id),
  ]);
  const vigentes = conveniosComercio.filter((c) => c.vigente_desde <= hoy && (c.vigente_hasta === null || c.vigente_hasta >= hoy));
  const opciones: OpcionDescuento[] = [];
  for (const credencial of creds.filter((c) => c.estado === "activa" && c.vigente_hasta.getTime() > Date.now())) {
    let mejor: OpcionDescuento | null = null;
    for (const convenio of vigentes.filter(
      (c) => c.emisor_id === credencial.emisor_id && c.tipo_beneficiario === credencial.tipo_beneficiario,
    )) {
      const usos = await repo.usosHoy(credencial.id, convenio.id);
      const calculo = calcularDescuento({ regla: convenio.regla, compra: s.compra, usos_hoy: usos });
      if (!mejor || calculo.descuento_centavos > mejor.calculo.descuento_centavos) mejor = { credencial, convenio, calculo };
    }
    if (mejor) opciones.push(mejor);
  }
  return opciones.sort((a, b) => b.calculo.descuento_centavos - a.calculo.descuento_centavos);
}

/** Vista previa para el cliente: qué compra, cuánto descuento y cuánto pagará. Nada se cobra aún. */
export async function previsualizarPago(u: UsuarioSesion, contenido: string) {
  const s = await solicitudDesdeQr(contenido);
  const comercio = await ctx().repo.comercio(s.comercio_id);
  const opciones = await opcionesDescuento(u.id, s);
  const emisores = new Map((await ctx().repo.emisores()).map((e) => [e.id, e.nombre_corto]));
  return {
    solicitud: {
      id: s.id,
      comercio: comercio?.nombre ?? "Comercio",
      compra: s.compra,
      total_centavos: s.total_centavos,
      expira_en: s.expira_en.toISOString(),
    },
    opciones: opciones.map((o) => ({
      credencial_id: o.credencial.id,
      emisor: emisores.get(o.credencial.emisor_id) ?? o.credencial.emisor_id,
      convenio: o.convenio.nombre,
      regla: describirRegla(o.convenio.regla),
      calculo: o.calculo,
    })),
    tiene_celular: Boolean(u.celular),
  };
}

// ===========================================================================
// 3. El CLIENTE confirma y paga
// ===========================================================================

export async function pagarSolicitud(
  u: UsuarioSesion,
  args: { contenido: string; credencialId: string; dispositivoId: string; metodo: "codi" | "efectivo"; revincular: boolean },
): Promise<Transaccion> {
  const { repo, pey } = ctx();
  const e = env();
  const s = await solicitudDesdeQr(args.contenido);

  // Credencial: dueño, firma del emisor, revocación, vigencia y dispositivo.
  const credencial = await validarCredencialParaPago(u.id, args.credencialId, args.dispositivoId, args.revincular);
  const opcion = (await opcionesDescuento(u.id, s)).find((o) => o.credencial.id === credencial.id);
  if (!opcion) throw new ErrorHttp(409, "sin_convenio", "Tu credencial no tiene convenio con este negocio.");
  const { convenio, calculo } = opcion;

  if (args.metodo === "codi") {
    if (!u.celular) throw new ErrorHttp(412, "sin_celular", "Registra tu celular para pagar con CoDi.");
    if (calculo.monto_final_centavos === 0) throw new ErrorHttp(422, "monto_cero", "Con tu descuento el total es $0. Elige efectivo.");
  }

  // Uso único: solo una persona puede tomar la solicitud.
  const tomada = await repo.tomarSolicitud(s.id);
  if (!tomada) throw new ErrorHttp(409, "solicitud_no_disponible", "Este cobro ya fue tomado o expiró. Pide uno nuevo al negocio.");

  const cobrado =
    args.metodo === "codi"
      ? montoACobrar({
          montoFinalCentavos: calculo.monto_final_centavos,
          modoPrueba: e.MODO_PRUEBA,
          montoPruebaCentavos: pesosACentavos(e.MONTO_PRUEBA_MXN),
        })
      : calculo.monto_final_centavos;

  const { transaccion: tx } = await repo.crearTransaccion({
    idempotency_key: `sol:${s.id}:${globalThis.crypto.randomUUID()}`,
    solicitud_id: s.id,
    comercio_id: s.comercio_id,
    credencial_id: credencial.id,
    convenio_id: convenio.id,
    compra: s.compra,
    precio_original_centavos: calculo.precio_original_centavos,
    descuento_centavos: calculo.descuento_centavos,
    monto_final_centavos: calculo.monto_final_centavos,
    monto_cobrado_centavos: cobrado,
    metodo: args.metodo,
    canal: args.metodo === "codi" ? "pn" : null,
    modo_prueba: args.metodo === "codi" && e.MODO_PRUEBA,
  });
  await repo.actualizarSolicitud(s.id, ["tomada"], { transaccion_id: tx.id });

  // Efectivo: queda pendiente hasta que el comercio confirme que recibió el dinero.
  if (args.metodo === "efectivo") {
    return (await repo.transicionarTransaccion(tx.id, ["creando"], { estado: "pendiente" }))!;
  }

  // CoDi: solicitud de cobro al celular del cliente. Un POST a Pey nunca se reintenta a ciegas.
  const comercio = await repo.comercio(s.comercio_id);
  const numRef = numRefDesdeId(tx.id);
  const expira = new Date(Date.now() + EXPIRACION_COBRO_SEG * 1000);
  try {
    const r = await pey.crearPushNotification({
      amount: centavosAPesos(cobrado),
      phoneNumber: u.celular!,
      concept: `${convenio.nombre} - ${comercio?.nombre ?? "Comercio"}`.slice(0, 120),
      expiration: EXPIRACION_COBRO_SEG,
      numRef,
      ...(comercio?.pey_bank_account_id ? { bankAccountId: comercio.pey_bank_account_id } : {}),
      metadata: { txId: tx.id, modoPrueba: e.MODO_PRUEBA },
    });
    return (await repo.transicionarTransaccion(tx.id, ["creando"], {
      estado: "pendiente",
      pey_id: r.transactionId,
      pey_codi_id: r.codiId,
      pey_num_ref: numRef,
      expira_en: expira,
    }))!;
  } catch (err) {
    const incierto = err instanceof PeyError ? err.incierto : true;
    const msg = (err instanceof Error ? err.message : "Error desconocido").slice(0, 300);
    if (incierto) {
      await repo.transicionarTransaccion(tx.id, ["creando"], { estado: "incierta", error: msg, expira_en: expira });
      throw new ErrorHttp(502, "cobro_incierto", "No confirmamos si el cobro llegó a tu banco. Revisa tu app bancaria en unos segundos.");
    }
    // Falla clara: se libera la solicitud para que el cliente pueda reintentar o pagar en efectivo.
    await repo.transicionarTransaccion(tx.id, ["creando"], { estado: "fallida", error: msg, solicitud_id: null });
    await repo.actualizarSolicitud(s.id, ["tomada"], { estado: "abierta", transaccion_id: null });
    throw new ErrorHttp(502, "cobro_fallido", "El sistema de pagos rechazó el cobro. Intenta de nuevo o paga en efectivo.");
  }
}

// ===========================================================================
// 4. Confirmación: webhook (aviso) → GET /transaction (prueba) → pagada
// ===========================================================================

async function alPagar(tx: Transaccion) {
  if (tx.solicitud_id) {
    await ctx().repo.actualizarSolicitud(tx.solicitud_id, ["tomada", "cancelada", "expirada"], { estado: "pagada" });
  }
  await notificarPago(tx);
}

async function confirmarConPey(tx: Transaccion, peyTx: TransaccionPey): Promise<Transaccion | null> {
  const { repo } = ctx();
  const r = confirmarPago(peyTx, { montoCentavos: tx.monto_cobrado_centavos, txId: tx.id, canal: tx.canal ?? "pn" });
  if (!r.ok) {
    if (r.error === "no_pagada") return null;
    console.error("[cobro] Pago no coincide", tx.id, r.error);
    await repo.transicionarTransaccion(tx.id, ["pendiente", "incierta", "expirada", "creando"], { error: `confirmacion:${r.error}` });
    return null;
  }
  const pagada = await repo.transicionarTransaccion(tx.id, ["creando", "pendiente", "incierta", "expirada", "cancelada"], {
    estado: "pagada",
    pey_id: peyTx.id,
    pagada_en: peyTx.datePaid ? new Date(peyTx.datePaid * 1000) : new Date(),
    error: null,
  });
  if (pagada) await alPagar(pagada);
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

  const nuevo = await repo.registrarWebhook({
    id: v.webhookId,
    tipo: v.evento ? v.evento.type : "tipo" in v ? v.tipo : "desconocido",
    payload: JSON.parse(cuerpoCrudo),
  });
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

/** Conciliación perezosa de cobros vencidos o inciertos (Pey no tiene webhooks de expiración). */
export async function refrescarTransaccion(tx: Transaccion): Promise<Transaccion> {
  const { repo, pey } = ctx();
  if (tx.metodo !== "codi") return tx;
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
  if (vencida) {
    const exp = await repo.transicionarTransaccion(tx.id, ["pendiente", "incierta"], { estado: "expirada" });
    if (exp?.solicitud_id) await repo.actualizarSolicitud(exp.solicitud_id, ["tomada"], { estado: "expirada" });
    return exp ?? tx;
  }
  return tx;
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

/** Vista de la transacción (el comercio nunca ve datos del cliente: solo el convenio aplicado). */
export async function vistaTransaccion(tx: Transaccion) {
  const { repo } = ctx();
  const [comercio, convenio] = await Promise.all([repo.comercio(tx.comercio_id), repo.convenio(tx.convenio_id)]);
  return {
    id: tx.id,
    solicitud_id: tx.solicitud_id,
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
