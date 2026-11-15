import type { EstadoVerificacion, ExtraccionDocumento } from "./providers";

export const UMBRAL_CONFIANZA = 0.8;
export const ANTIGUEDAD_MAX_DIAS = 92; // ~3 meses

/** ¿El correo pertenece a alguno de los dominios permitidos del emisor? (exacto, sin subdominios arbitrarios) */
export function correoEnDominio(correo: string, dominios: readonly string[]): boolean {
  const at = correo.trim().toLowerCase().lastIndexOf("@");
  if (at < 1) return false;
  const dominio = correo
    .trim()
    .toLowerCase()
    .slice(at + 1);
  return dominios.some((d) => d.toLowerCase().replace(/^@/, "") === dominio);
}

/** Normaliza nombre: minúsculas, sin acentos, sin signos, espacios simples. */
export function normalizarNombre(n: string): string {
  return n
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coincidencia de nombre tolerante: todas las palabras declaradas (≥3 letras) aparecen en el documento. */
export function nombresCoinciden(declarado: string, documento: string): boolean {
  const doc = new Set(normalizarNombre(documento).split(" "));
  const palabras = normalizarNombre(declarado)
    .split(" ")
    .filter((p) => p.length >= 3);
  return palabras.length >= 2 && palabras.every((p) => doc.has(p));
}

export interface EvaluacionDocumento {
  estado: EstadoVerificacion;
  motivos: string[];
}

/**
 * Decide con base en la extracción:
 * - rechazo claro (otro tipo, vencido o viejo) → rechazada
 * - todo coincide y confianza ≥ umbral → aprobada
 * - lo demás → revisión manual del emisor
 */
export function evaluarDocumento(args: {
  extraccion: ExtraccionDocumento;
  nombreDeclarado: string;
  tiposAceptados: readonly ExtraccionDocumento["tipo_documento"][];
  palabrasInstitucion: readonly string[];
  ahora?: Date;
}): EvaluacionDocumento {
  const { extraccion: x, ahora = new Date() } = args;
  const motivos: string[] = [];
  const dia = 86_400_000;

  if (x.tipo_documento === "ilegible")
    return { estado: "revision_manual", motivos: ["documento_ilegible"] };
  if (!args.tiposAceptados.includes(x.tipo_documento))
    return { estado: "rechazada", motivos: ["tipo_no_aceptado"] };

  // Vigencia: o bien vigencia activa, o bien emitido en los últimos ~3 meses.
  const vigencia = x.vigencia_hasta ? new Date(`${x.vigencia_hasta}T23:59:59-06:00`) : null;
  const emision = x.fecha_emision ? new Date(`${x.fecha_emision}T00:00:00-06:00`) : null;
  if (vigencia && vigencia.getTime() < ahora.getTime())
    return { estado: "rechazada", motivos: ["documento_vencido"] };
  if (!vigencia) {
    if (!emision) motivos.push("sin_fechas");
    else if (ahora.getTime() - emision.getTime() > ANTIGUEDAD_MAX_DIAS * dia) {
      return { estado: "rechazada", motivos: ["documento_antiguo"] };
    } else if (emision.getTime() > ahora.getTime() + dia) motivos.push("fecha_futura");
  }

  if (!x.nombre_completo || !nombresCoinciden(args.nombreDeclarado, x.nombre_completo))
    motivos.push("nombre_no_coincide");

  const inst = x.institucion ? normalizarNombre(x.institucion) : "";
  if (!args.palabrasInstitucion.some((p) => inst.includes(normalizarNombre(p))))
    motivos.push("institucion_no_coincide");

  if (x.confianza < UMBRAL_CONFIANZA) motivos.push("confianza_baja");

  return { estado: motivos.length === 0 ? "aprobada" : "revision_manual", motivos };
}

/** Celular MX de 10 dígitos, como lo pide Pey (`^[0-9]{10}$`). Acepta +52 / 52 / espacios / guiones. */
export function normalizarCelularMx(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("52")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("521")) d = d.slice(3);
  return /^[0-9]{10}$/.test(d) ? d : null;
}

export function enmascararCelular(cel: string): string {
  return cel.length === 10 ? `•• •••• ${cel.slice(6)}` : "••••";
}
