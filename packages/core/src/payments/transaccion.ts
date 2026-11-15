import { formatoMXN, type Centavos } from "../money";

export type MetodoPago = "codi" | "efectivo";
export type CanalCodi = "pn" | "qr";

/**
 * Estados de una transacción local.
 * creando → pendiente → pagada
 *        ↘ incierta (timeout al crear en Pey; se concilia)
 * pendiente → expirada | cancelada | fallida
 */
export type EstadoTransaccion =
  "creando" | "pendiente" | "incierta" | "pagada" | "expirada" | "cancelada" | "fallida";

const TRANSICIONES: Record<EstadoTransaccion, readonly EstadoTransaccion[]> = {
  creando: ["pendiente", "incierta", "fallida", "pagada"],
  incierta: ["pendiente", "pagada", "fallida", "expirada"],
  pendiente: ["pagada", "expirada", "cancelada", "fallida"],
  // Un pago puede llegar tarde a una transacción que ya marcamos como expirada: se acepta.
  expirada: ["pagada"],
  cancelada: ["pagada"],
  pagada: [],
  fallida: [],
};

export function puedeTransicionar(de: EstadoTransaccion, a: EstadoTransaccion): boolean {
  return TRANSICIONES[de].includes(a);
}

export const ESTADOS_FINALES: readonly EstadoTransaccion[] = ["pagada", "fallida"];

/**
 * Monto que realmente se cobra por CoDi. En MODO_PRUEBA se cobra un monto simbólico
 * (Pey solo tiene producción y no devuelve pagos), pero el ticket muestra el desglose real.
 */
export function montoACobrar(args: {
  montoFinalCentavos: Centavos;
  modoPrueba: boolean;
  montoPruebaCentavos: Centavos;
}): Centavos {
  if (!args.modoPrueba) return args.montoFinalCentavos;
  if (!Number.isSafeInteger(args.montoPruebaCentavos) || args.montoPruebaCentavos <= 0) {
    throw new RangeError("MONTO_PRUEBA_MXN debe ser mayor a 0");
  }
  return Math.min(args.montoPruebaCentavos, args.montoFinalCentavos);
}

/** numRef de Pey: hasta 7 dígitos. Derivado de forma estable del id local. */
export function numRefDesdeId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % 10_000_000);
}

export interface Ticket {
  folio: string;
  comercio: string;
  convenio: string;
  precio_original: string;
  descuento: string;
  monto_pagado: string;
  monto_cobrado_real?: string;
  metodo: MetodoPago;
  fecha: string;
  pey_id: string | null;
  modo_prueba: boolean;
}

export function construirTicket(t: {
  id: string;
  comercio: string;
  convenio: string;
  precioOriginal: Centavos;
  descuento: Centavos;
  montoFinal: Centavos;
  montoCobrado: Centavos;
  metodo: MetodoPago;
  pagadaEn: Date;
  peyId: string | null;
  modoPrueba: boolean;
}): Ticket {
  return {
    folio: t.id.slice(0, 8).toUpperCase(),
    comercio: t.comercio,
    convenio: t.convenio,
    precio_original: formatoMXN(t.precioOriginal),
    descuento: formatoMXN(t.descuento),
    monto_pagado: formatoMXN(t.montoFinal),
    ...(t.modoPrueba && t.metodo === "codi"
      ? { monto_cobrado_real: formatoMXN(t.montoCobrado) }
      : {}),
    metodo: t.metodo,
    fecha: t.pagadaEn.toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
    pey_id: t.peyId,
    modo_prueba: t.modoPrueba,
  };
}
