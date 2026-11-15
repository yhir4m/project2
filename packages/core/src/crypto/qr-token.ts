import { SignJWT, type CryptoKey } from "jose";
import { z } from "zod";
import { ALG, type ResolverLlavePublica } from "./keys";
import { verificarJws, type ErrorFirma } from "./credential";

export const QR_TTL_SEGUNDOS = 45;
/** Prefijo para distinguir nuestros QR de cualquier otro código escaneado. */
export const QR_PREFIJO = "CDV1.";

/**
 * Token del QR dinámico del beneficiario. Lo firma el servidor con la llave del emisor
 * y SOLO para la sesión autenticada dueña de la credencial.
 * No lleva datos personales: seudónimo, credencial, tipo, nonce, dispositivo y expiración.
 */
export const ClaimsQrSchema = z.object({
  typ: z.literal("cdv-qr"),
  iss: z.string().min(1),
  sub: z.string().min(1), // seudónimo
  cid: z.string().min(1), // id de credencial
  tb: z.string().min(1),
  jti: z.string().min(16), // nonce de un solo uso
  dev: z.string().min(16), // hash del dispositivo ligado
  iat: z.number().int(),
  exp: z.number().int(),
});
export type ClaimsQr = z.infer<typeof ClaimsQrSchema>;

export interface EmitirQrInput {
  emisorId: string;
  seudonimo: string;
  credencialId: string;
  tipoBeneficiario: string;
  dispositivoHash: string;
  nonce: string;
  /** No puede exceder la vigencia de la credencial. */
  credencialVenceEn: Date;
  ahora?: Date;
  ttlSeg?: number;
}

export async function firmarQr(
  input: EmitirQrInput,
  llavePrivada: CryptoKey,
): Promise<{ token: string; exp: number }> {
  const iat = Math.floor((input.ahora ?? new Date()).getTime() / 1000);
  const exp = Math.min(
    iat + (input.ttlSeg ?? QR_TTL_SEGUNDOS),
    Math.floor(input.credencialVenceEn.getTime() / 1000),
  );
  if (exp <= iat) throw new RangeError("Credencial vencida");
  const jws = await new SignJWT({
    typ: "cdv-qr",
    cid: input.credencialId,
    tb: input.tipoBeneficiario,
    dev: input.dispositivoHash,
  })
    .setProtectedHeader({ alg: ALG, kid: input.emisorId })
    .setIssuer(input.emisorId)
    .setSubject(input.seudonimo)
    .setJti(input.nonce)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(llavePrivada);
  return { token: QR_PREFIJO + jws, exp };
}

// ---------------------------------------------------------------------------
// Verificación completa (firma + estado del servidor). Las dependencias se inyectan
// para que la lógica sea pura y probable; el servidor las implementa contra Supabase.
// ---------------------------------------------------------------------------

export interface CredencialEstado {
  id: string;
  emisor_id: string;
  seudonimo: string;
  estado: "activa" | "revocada" | "vencida";
  vigente_hasta: Date;
  dispositivo_hash: string | null;
}

export interface ConvenioAplicable {
  id: string;
  nombre: string;
}

export interface DependenciasVerificacionQr {
  resolverLlave: ResolverLlavePublica;
  obtenerCredencial: (credencialId: string) => Promise<CredencialEstado | null>;
  /** Busca un convenio activo del emisor para ese tipo de beneficiario y ese comercio. */
  buscarConvenio: (args: {
    emisorId: string;
    tipoBeneficiario: string;
    comercioId: string;
  }) => Promise<ConvenioAplicable | null>;
  /** Marca el nonce como usado de forma ATÓMICA. Regresa false si ya se había usado. */
  consumirNonce: (nonce: string, expiraEn: Date) => Promise<boolean>;
}

export type ErrorQr =
  | ErrorFirma
  | "no_es_qr_del_sistema"
  | "credencial_no_encontrada"
  | "credencial_revocada"
  | "credencial_vencida"
  | "credencial_no_coincide"
  | "dispositivo_no_coincide"
  | "sin_convenio"
  | "qr_ya_usado";

export type ResultadoQr =
  | { ok: true; claims: ClaimsQr; credencial: CredencialEstado; convenio: ConvenioAplicable }
  | { ok: false; error: ErrorQr };

export async function verificarQr(
  contenido: string,
  comercioId: string,
  deps: DependenciasVerificacionQr,
  opciones: { ahora?: Date } = {},
): Promise<ResultadoQr> {
  const raw = contenido.trim();
  if (!raw.startsWith(QR_PREFIJO)) return { ok: false, error: "no_es_qr_del_sistema" };

  const firma = await verificarJws(
    raw.slice(QR_PREFIJO.length),
    deps.resolverLlave,
    ClaimsQrSchema,
    {
      ahora: opciones.ahora,
      toleranciaSeg: 3,
    },
  );
  if (!firma.ok) return firma;
  const c = firma.claims;
  if (c.exp - c.iat > QR_TTL_SEGUNDOS + 5) return { ok: false, error: "formato_invalido" };

  // Revocación: se consulta SIEMPRE en el servidor.
  const cred = await deps.obtenerCredencial(c.cid);
  if (!cred) return { ok: false, error: "credencial_no_encontrada" };
  if (cred.emisor_id !== c.iss || cred.seudonimo !== c.sub)
    return { ok: false, error: "credencial_no_coincide" };
  if (cred.estado === "revocada") return { ok: false, error: "credencial_revocada" };
  const ahora = opciones.ahora ?? new Date();
  if (cred.estado === "vencida" || cred.vigente_hasta.getTime() <= ahora.getTime()) {
    return { ok: false, error: "credencial_vencida" };
  }
  if (cred.dispositivo_hash && cred.dispositivo_hash !== c.dev)
    return { ok: false, error: "dispositivo_no_coincide" };

  const convenio = await deps.buscarConvenio({
    emisorId: c.iss,
    tipoBeneficiario: c.tb,
    comercioId,
  });
  if (!convenio) return { ok: false, error: "sin_convenio" };

  // Antirreplay: último paso y atómico.
  const nuevo = await deps.consumirNonce(c.jti, new Date(c.exp * 1000));
  if (!nuevo) return { ok: false, error: "qr_ya_usado" };

  return { ok: true, claims: c, credencial: cred, convenio };
}

/** Mensajes claros, sin jerga, para el comercio. */
export const MENSAJES_ERROR_QR: Record<ErrorQr, string> = {
  firma_invalida: "Este código no es válido.",
  formato_invalido: "Este código no es válido.",
  emisor_desconocido: "La institución de este código no está registrada.",
  expirado: "El código ya expiró. Pide que lo actualicen.",
  no_es_qr_del_sistema: "Este no es un código de descuento.",
  credencial_no_encontrada: "No encontramos la credencial.",
  credencial_no_coincide: "Este código no es válido.",
  credencial_revocada: "La credencial fue dada de baja.",
  credencial_vencida: "La credencial ya venció.",
  dispositivo_no_coincide: "El código no viene del teléfono registrado.",
  sin_convenio: "Este negocio no tiene convenio con esta institución.",
  qr_ya_usado: "Este código ya se usó. Pide uno nuevo.",
};
