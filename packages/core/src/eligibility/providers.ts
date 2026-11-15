import { z } from "zod";

/** Datos que extrae la IA de un documento. Validado con zod en la frontera. */
export const ExtraccionDocumentoSchema = z.object({
  nombre_completo: z.string().nullable(),
  institucion: z.string().nullable(),
  tipo_documento: z.enum([
    "constancia_estudios",
    "credencial_estudiante",
    "credencial_inapam",
    "otro",
    "ilegible",
  ]),
  fecha_emision: z.string().date().nullable(),
  vigencia_hasta: z.string().date().nullable(),
  confianza: z.number().min(0).max(1),
  observaciones: z.string().max(500).nullable(),
});
export type ExtraccionDocumento = z.infer<typeof ExtraccionDocumentoSchema>;

/** Proveedor de extracción de documentos (hoy xAI Grok; intercambiable). */
export interface DocumentExtractor {
  readonly nombre: string;
  extraer(args: { imagen: Uint8Array; mimeType: string }): Promise<ExtraccionDocumento>;
}

export type MetodoVerificacion = "correo_institucional" | "documento_ia" | "externo";
export type EstadoVerificacion = "aprobada" | "rechazada" | "revision_manual";

export interface SolicitudVerificacion {
  emisorId: string;
  tipoBeneficiario: string;
  nombreDeclarado: string;
  datos:
    | { metodo: "correo_institucional"; correoVerificado: string }
    | { metodo: "documento_ia"; imagen: Uint8Array; mimeType: string }
    | { metodo: "externo"; referencia: string };
}

export interface ResultadoVerificacionElegibilidad {
  estado: EstadoVerificacion;
  metodo: MetodoVerificacion;
  confianza: number | null;
  motivos: string[];
}

/**
 * Punto de extensión: correo institucional, documento con IA o un proveedor externo
 * (tipo SheerID) o una API institucional, sin tocar el resto del sistema.
 */
export interface VerificationProvider {
  readonly metodo: MetodoVerificacion;
  verificar(s: SolicitudVerificacion): Promise<ResultadoVerificacionElegibilidad>;
}
