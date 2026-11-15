export type TipoPeriodo = "cuatrimestre" | "semestre" | "anual";

/**
 * Fin del periodo vigente (último instante del último día, hora de Ciudad de México ≈ UTC-6).
 * - cuatrimestre: ene–abr, may–ago, sep–dic
 * - semestre: ene–jun, jul–dic
 * - anual: 31 de diciembre
 */
export function finDePeriodo(tipo: TipoPeriodo, ahora: Date = new Date()): Date {
  const y = ahora.getUTCFullYear();
  const m = ahora.getUTCMonth(); // 0-11
  let mesFin: number; // 0-11
  switch (tipo) {
    case "cuatrimestre":
      mesFin = m < 4 ? 3 : m < 8 ? 7 : 11;
      break;
    case "semestre":
      mesFin = m < 6 ? 5 : 11;
      break;
    case "anual":
      mesFin = 11;
      break;
  }
  // Día 0 del mes siguiente = último día del mes. 23:59:59 CDMX = 05:59:59 UTC del día siguiente.
  const ultimoDia = new Date(Date.UTC(y, mesFin + 1, 0));
  return new Date(Date.UTC(y, mesFin, ultimoDia.getUTCDate() + 1, 5, 59, 59));
}
