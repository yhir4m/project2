import "server-only";
import {
  calcularDescuento,
  centavosAPesos,
  construirTicket,
  describirRegla,
  montoACobrar,
  numRefDesdeId,
  pesosACentavos,
  totalCompra,
  COBRO_TTL_SEGUNDOS,
  type Compra,
  type ResultadoDescuento,
  type Ticket,
} from "@cdv/core";
import type { Convenio, Credencial, Perfil, Producto, Transaccion } from "@cdv/db";
import { confirmarPago, PeyError, verificarWebhook, type TransaccionPey } from "@cdv/pey";
import { ctx, registrarProcesadorWebhook } from "./contexto";
import { validarCredencialParaPago } from "./credenciales";
import { env } from "./env";
import { ErrorHttp, type UsuarioSesion } from "./sesion";

/** Pey exige expiración ≥ 360 s en /codi/pn. */
export const EXPIRACION_COBRO_SEG = 360;

// ===========================================================================
// 1. El COMERCIO configura sus QR fijos (un QR por producto/servicio con precio fijo)
// ===========================================================================

/** Contenido del QR fijo de un producto: enlace corto que abre la pantalla de pago. */
export function qrDeProducto(productoId: string, urlPublica: string): string {
  return `${urlPublica.replace(/\/$/, "")}/pagar/p/${productoId}`;
}

export async function crearQr(comercioId: string, nombre: string, precioCentavos: number) {
  const sku = `QR-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  return ctx().repo.crearProducto({ comercio_id: comercioId, sku, nombre, precio_centavos: precioCentavos });
}

export async function solicitudDeComercio(id: string, comercioId: string) {
  const s = await ctx().repo.solicitud(id);
  if (!s || s.comercio_id !== comercioId) throw new ErrorHttp(404, "no_encontrada", "No encontramos este cobro.");
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
  if (!s.transaccion_id) throw new ErrorHttp(409, "sin_cliente", "Este cobro no tiene pago.");
  const tx = await repo.transaccion(s.transaccion_id);
  if (!tx || tx.metodo !== "efectivo") throw new ErrorHttp(409, "no_es_efectivo", "Este cobro no es en efectivo.");
  const pagada = await repo.transicionarTransaccion(tx.id, ["pendiente"], { estado: "pagada", pagada_en: new Date() });
  if (pagada) await alPagar(pagada);
  return pagada ?? tx;
}

// ===========================================================================
// 2. Quien paga escanea el QR fijo: precio del QR → descuento según su perfil
// ===========================================================================

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Lee el QR del negocio de forma tolerante: busca el primer id (UUID) en CUALQUIER texto escaneado
 * (enlace completo, con o sin parámetros, mayúsculas, solo el id…). Si es un producto activo → ese QR.
 */
async function productoDesdeQr(contenido: string) {
  const raw = contenido.trim();
  const { repo } = ctx();
  let id = raw.match(UUID)?.[0]?.toLowerCase() ?? null;
  if (!id) {
    try {
      id = decodeURIComponent(raw).match(UUID)?.[0]?.toLowerCase() ?? null;
    } catch {
      /* texto no decodificable */
    }
  }
  if (!id) {
    console.warn("[qr] contenido sin id:", JSON.stringify(raw.slice(0, 160)));
    throw new ErrorHttp(422, "no_es_cobro", "Este no es un código de cobro de un negocio afiliado.");
  }
  const producto = await repo.producto(id);
  if (!producto) {
    console.warn("[qr] id no es un producto:", id, JSON.stringify(raw.slice(0, 160)));
    if (await repo.solicitud(id)) {
      throw new ErrorHttp(422, "qr_anterior", "Este QR es de una versión anterior. Escanea un QR de “Mis QR” del negocio.");
    }
    throw new ErrorHttp(422, "no_es_cobro", "Este no es un código de cobro de un negocio afiliado.");
  }
  const comercio = await repo.comercio(producto.comercio_id);
  if (!producto.activo || !comercio || !comercio.activo) {
    throw new ErrorHttp(404, "qr_inactivo", "Este código ya no está activo. Pide al negocio el código vigente.");
  }
  return { producto, comercio };
}

function compraDe(producto: Producto, cantidad: number): Compra {
  return {
    tipo: "productos",
    items: [{ sku: producto.sku, nombre: producto.nombre, precio_centavos: producto.precio_centavos, cantidad }],
  };
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
 * Resultado ordenado: mejor descuento primero. Lista vacía = precio general.
 */
async function opcionesDescuento(usuarioId: string, comercioId: string, compra: Compra): Promise<OpcionDescuento[]> {
  const { repo } = ctx();
  const hoy = hoyCdmx();
  const [creds, conveniosComercio] = await Promise.all([repo.credencialesDeUsuario(usuarioId), repo.conveniosDeComercio(comercioId)]);
  const vigentes = conveniosComercio.filter((c) => c.vigente_desde <= hoy && (c.vigente_hasta === null || c.vigente_hasta >= hoy));
  const opciones: OpcionDescuento[] = [];
  for (const credencial of creds.filter((c) => c.estado === "activa" && c.vigente_hasta.getTime() > Date.now())) {
    let mejor: OpcionDescuento | null = null;
    for (const convenio of vigentes.filter(
      (c) => c.emisor_id === credencial.emisor_id && c.tipo_beneficiario === credencial.tipo_beneficiario,
    )) {
      const usos = await repo.usosHoy(credencial.id, convenio.id);
      const calculo = calcularDescuento({ regla: convenio.regla, compra, usos_hoy: usos });
      if (!mejor || calculo.descuento_centavos > mejor.calculo.descuento_centavos) mejor = { credencial, convenio, calculo };
    }
    if (mejor) opciones.push(mejor);
  }
  return opciones.sort((a, b) => b.calculo.descuento_centavos - a.calculo.descuento_centavos);
}

/** Vista previa: producto y precio del QR, y lo que paga esta persona según su perfil. Nada se cobra aún. */
export async function previsualizarPago(u: UsuarioSesion, contenido: string, cantidad: number) {
  const { producto, comercio } = await productoDesdeQr(contenido);
  const compra = compraDe(producto, cantidad);
  const total = totalCompra(compra);
  const opciones = await opcionesDescuento(u.id, comercio.id, compra);
  const emisores = new Map((await ctx().repo.emisores()).map((e) => [e.id, e.nombre_corto]));
  return {
    qr: { producto_id: producto.id, comercio: comercio.nombre, concepto: producto.nombre, precio_centavos: producto.precio_centavos },
    cantidad,
    total_centavos: total,
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
// 3. Quien paga confirma: cada escaneo crea su propio cobro (el QR es reutilizable)
// ===========================================================================

export async function pagarDesdeQr(
  u: UsuarioSesion,
  args: {
    contenido: string;
    cantidad: number;
    credencialId: string | null;
    dispositivoId: string;
    metodo: "codi" | "efectivo";
    revincular: boolean;
  },
): Promise<Transaccion> {
  const { repo, pey } = ctx();
  const e = env();
  const { producto, comercio } = await productoDesdeQr(args.contenido);
  const compra = compraDe(producto, args.cantidad);

  // Con credencial → descuento según su convenio (firma del emisor, revocación, dispositivo).
  // Sin credencial → precio general.
  let credencial: Credencial | null = null;
  let convenio: Convenio | null = null;
  let calculo: ResultadoDescuento;
  if (args.credencialId) {
    credencial = await validarCredencialParaPago(u.id, args.credencialId, args.dispositivoId, args.revincular);
    const opcion = (await opcionesDescuento(u.id, comercio.id, compra)).find((o) => o.credencial.id === credencial!.id);
    if (!opcion) throw new ErrorHttp(409, "sin_convenio", "Tu credencial no tiene convenio con este negocio.");
    convenio = opcion.convenio;
    calculo = opcion.calculo;
  } else {
    const total = totalCompra(compra);
    calculo = {
      precio_original_centavos: total,
      base_elegible_centavos: 0,
      descuento_centavos: 0,
      monto_final_centavos: total,
      aplicado: false,
      tope_aplicado: false,
    };
  }

  if (args.metodo === "codi") {
    if (!u.celular) throw new ErrorHttp(412, "sin_celular", "Registra tu celular para pagar con CoDi.");
    if (calculo.monto_final_centavos === 0) throw new ErrorHttp(422, "monto_cero", "Con tu descuento el total es $0. Elige efectivo.");
  }

  // Cada pago es un cobro nuevo y de un solo uso (registro para el comercio y el webhook).
  const solicitud = await repo.crearSolicitud({
    comercio_id: comercio.id,
    compra,
    total_centavos: calculo.precio_original_centavos,
    expira_en: new Date(Date.now() + COBRO_TTL_SEGUNDOS * 1000),
  });
  const s = await repo.tomarSolicitud(solicitud.id);
  if (!s) throw new ErrorHttp(409, "solicitud_no_disponible", "No se pudo iniciar el cobro. Intenta de nuevo.");

  const cobrado =
    args.metodo === "codi"
      ? montoACobrar({
          montoFinalCentavos: calculo.monto_final_centavos,
          modoPrueba: e.MODO_PRUEBA,
          montoPruebaCentavos: pesosACentavos(e.MONTO_PRUEBA_MXN),
        })
      : calculo.monto_final_centavos;

  const { transaccion: tx } = await repo.crearTransaccion({
    idempotency_key: `sol:${s.id}`,
    solicitud_id: s.id,
    comercio_id: comercio.id,
    pagador_id: u.id,
    credencial_id: credencial?.id ?? null,
    convenio_id: convenio?.id ?? null,
    compra,
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

  // CoDi: solicitud de cobro al celular de quien paga. Un POST a Pey nunca se reintenta a ciegas.
  const numRef = numRefDesdeId(tx.id);
  const expira = new Date(Date.now() + EXPIRACION_COBRO_SEG * 1000);
  const concepto = `${producto.nombre}${convenio ? ` - ${convenio.nombre}` : ""} - ${comercio.nombre}`.slice(0, 120);
  try {
    const r = await pey.crearPushNotification({
      amount: centavosAPesos(cobrado),
      phoneNumber: u.celular!,
      concept: concepto,
      expiration: EXPIRACION_COBRO_SEG,
      numRef,
      ...(comercio.pey_bank_account_id ? { bankAccountId: comercio.pey_bank_account_id } : {}),
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
    console.error("[pey] crearPushNotification", err instanceof PeyError ? { status: err.status, tipo: err.tipo, requestId: err.requestId } : msg);
    if (incierto) {
      await repo.transicionarTransaccion(tx.id, ["creando"], { estado: "incierta", error: msg, expira_en: expira });
      throw new ErrorHttp(502, "cobro_incierto", "No confirmamos si el cobro llegó a tu banco. Revisa tu app bancaria en unos segundos.");
    }
    await repo.transicionarTransaccion(tx.id, ["creando"], { estado: "fallida", error: msg });
    await repo.actualizarSolicitud(s.id, ["tomada"], { estado: "cancelada" });
    const detalle = err instanceof PeyError ? ` (${err.message})` : "";
    throw new ErrorHttp(502, "cobro_fallido", `El sistema de pagos rechazó el cobro${detalle}. Intenta de nuevo o paga en efectivo.`);
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
  const [comercio, convenio] = await Promise.all([
    repo.comercio(tx.comercio_id),
    tx.convenio_id ? repo.convenio(tx.convenio_id) : Promise.resolve(null),
  ]);
  if (!tx.pagador_id) return;
  const t = ticketDe(tx, comercio?.nombre ?? "Comercio", convenio?.nombre ?? PRECIO_GENERAL);
  await repo.notificar({
    usuario_id: tx.pagador_id,
    tipo: "pago_confirmado",
    titulo: `Pagaste ${t.monto_pagado} en ${t.comercio}`,
    cuerpo: convenio ? `Ahorraste ${t.descuento} con ${t.convenio}.` : "Pago a precio general.",
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
const PRECIO_GENERAL = "Precio general (sin descuento)";

export async function vistaTransaccion(tx: Transaccion) {
  const { repo } = ctx();
  const [comercio, convenio] = await Promise.all([
    repo.comercio(tx.comercio_id),
    tx.convenio_id ? repo.convenio(tx.convenio_id) : Promise.resolve(null),
  ]);
  return {
    id: tx.id,
    solicitud_id: tx.solicitud_id,
    estado: tx.estado,
    metodo: tx.metodo,
    canal: tx.canal,
    comercio: comercio?.nombre ?? "Comercio",
    convenio: convenio?.nombre ?? PRECIO_GENERAL,
    con_descuento: Boolean(convenio),
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
    ticket: tx.estado === "pagada" ? ticketDe(tx, comercio?.nombre ?? "Comercio", convenio?.nombre ?? PRECIO_GENERAL) : null,
    simulado: env().PEY_SIMULADO,
  };
}
export type VistaTransaccion = Awaited<ReturnType<typeof vistaTransaccion>>;

export async function puedeVerTransaccion(tx: Transaccion, u: Perfil): Promise<boolean> {
  if (u.rol === "comercio") return tx.comercio_id === u.comercio_id;
  if (u.rol === "beneficiario") return tx.pagador_id === u.id;
  return false;
}
