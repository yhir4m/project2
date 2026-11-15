import type { Centavos } from "../money";
import { ReglaConvenioSchema, type Compra, type ReglaConvenio } from "./schema";

export type MotivoSinDescuento =
  "limite_diario" | "sin_productos_elegibles" | "requiere_productos" | "monto_minimo";

export interface ResultadoDescuento {
  precio_original_centavos: Centavos;
  base_elegible_centavos: Centavos;
  descuento_centavos: Centavos;
  monto_final_centavos: Centavos;
  aplicado: boolean;
  /** Presente cuando `aplicado = false`. */
  motivo?: MotivoSinDescuento;
  /** Si el tope limitó el descuento. */
  tope_aplicado: boolean;
}

export interface EntradaDescuento {
  regla: ReglaConvenio;
  compra: Compra;
  /** Compras con descuento que el beneficiario ya hizo hoy en este convenio. */
  usos_hoy: number;
}

/**
 * Motor de reglas: calcula el descuento. Es puro y determinista, y SOLO se confía en él del lado del servidor.
 * Redondeo: el descuento porcentual se redondea hacia abajo al centavo (nunca se descuenta de más).
 */
export function calcularDescuento({
  regla: reglaIn,
  compra,
  usos_hoy,
}: EntradaDescuento): ResultadoDescuento {
  const regla = ReglaConvenioSchema.parse(reglaIn);

  const original = totalCompra(compra);
  const sinDescuento = (motivo: MotivoSinDescuento, base = 0): ResultadoDescuento => ({
    precio_original_centavos: original,
    base_elegible_centavos: base,
    descuento_centavos: 0,
    monto_final_centavos: original,
    aplicado: false,
    motivo,
    tope_aplicado: false,
  });

  if (!Number.isInteger(usos_hoy) || usos_hoy < 0) throw new RangeError("usos_hoy inválido");
  if (regla.usos_por_dia !== undefined && usos_hoy >= regla.usos_por_dia) {
    return sinDescuento("limite_diario");
  }

  let base: number;
  if (regla.productos) {
    if (compra.tipo === "monto") return sinDescuento("requiere_productos");
    const elegibles = new Set(regla.productos);
    base = compra.items
      .filter((i) => elegibles.has(i.sku))
      .reduce((s, i) => s + i.precio_centavos * i.cantidad, 0);
    if (base === 0) return sinDescuento("sin_productos_elegibles");
  } else {
    base = original;
  }

  if (regla.monto_minimo_centavos !== undefined && base < regla.monto_minimo_centavos) {
    return sinDescuento("monto_minimo", base);
  }

  let descuento =
    regla.tipo === "porcentaje"
      ? Math.floor((base * regla.valor) / 100)
      : Math.min(regla.valor, base);

  let tope_aplicado = false;
  if (regla.tope_centavos !== undefined && descuento > regla.tope_centavos) {
    descuento = regla.tope_centavos;
    tope_aplicado = true;
  }
  descuento = Math.max(0, Math.min(descuento, original));

  return {
    precio_original_centavos: original,
    base_elegible_centavos: base,
    descuento_centavos: descuento,
    monto_final_centavos: original - descuento,
    aplicado: descuento > 0,
    tope_aplicado,
  };
}

export function totalCompra(compra: Compra): Centavos {
  const total =
    compra.tipo === "monto"
      ? compra.monto_centavos
      : compra.items.reduce((s, i) => s + i.precio_centavos * i.cantidad, 0);
  if (!Number.isSafeInteger(total) || total <= 0) throw new RangeError("Total de compra inválido");
  return total;
}

/** Texto corto y claro para mostrar la regla (comercio / beneficiario). */
export function describirRegla(regla: ReglaConvenio): string {
  const base =
    regla.tipo === "porcentaje"
      ? `${regla.valor}% de descuento`
      : `$${(regla.valor / 100).toFixed(2)} de descuento`;
  const partes = [base];
  if (regla.tope_centavos) partes.push(`hasta $${(regla.tope_centavos / 100).toFixed(2)}`);
  if (regla.productos) partes.push("en productos participantes");
  if (regla.usos_por_dia)
    partes.push(`${regla.usos_por_dia} ${regla.usos_por_dia === 1 ? "vez" : "veces"} al día`);
  return partes.join(", ");
}
