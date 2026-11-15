import { SignJWT, jwtVerify, errors } from "jose";
import { z } from "zod";

/** Prefijo de los QR de cobro de la plataforma (distingue nuestro QR de cualquier otro). */
export const COBRO_PREFIJO = "CDVC1.";
/** Vigencia del QR de cobro del comercio. */
export const COBRO_TTL_SEGUNDOS = 5 * 60;

/**
 * QR de cobro que muestra el COMERCIO. Lo firma la plataforma (HS256, secreto del servidor)
 * y solo apunta a una solicitud: el monto real y el descuento se resuelven en el servidor.
 * El uso único lo garantiza la base (tomar_solicitud es atómico).
 */
export const ClaimsCobroSchema = z.object({
  typ: z.literal("cdv-cobro"),
  sid: z.string().uuid(), // solicitud de cobro
  com: z.string().uuid(), // comercio
  iat: z.number().int(),
  exp: z.number().int(),
});
export type ClaimsCobro = z.infer<typeof ClaimsCobroSchema>;

export async function firmarCobro(
  args: { solicitudId: string; comercioId: string; expiraEn: Date; ahora?: Date },
  secreto: Uint8Array,
): Promise<string> {
  const iat = Math.floor((args.ahora ?? new Date()).getTime() / 1000);
  const exp = Math.floor(args.expiraEn.getTime() / 1000);
  if (exp <= iat) throw new RangeError("La solicitud ya expiró");
  const jws = await new SignJWT({ typ: "cdv-cobro", sid: args.solicitudId, com: args.comercioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secreto);
  return COBRO_PREFIJO + jws;
}

export type ErrorCobroQr = "no_es_cobro" | "expirado" | "firma_invalida";

export async function leerCobro(
  contenido: string,
  secreto: Uint8Array,
  opciones: { ahora?: Date } = {},
): Promise<{ ok: true; claims: ClaimsCobro } | { ok: false; error: ErrorCobroQr }> {
  const raw = contenido.trim();
  if (!raw.startsWith(COBRO_PREFIJO)) return { ok: false, error: "no_es_cobro" };
  try {
    const { payload } = await jwtVerify(raw.slice(COBRO_PREFIJO.length), secreto, {
      algorithms: ["HS256"],
      currentDate: opciones.ahora,
      clockTolerance: 5,
      requiredClaims: ["exp", "iat"],
    });
    const p = ClaimsCobroSchema.safeParse(payload);
    if (!p.success) return { ok: false, error: "firma_invalida" };
    if (p.data.exp - p.data.iat > COBRO_TTL_SEGUNDOS + 5) return { ok: false, error: "firma_invalida" };
    return { ok: true, claims: p.data };
  } catch (e) {
    if (e instanceof errors.JWTExpired) return { ok: false, error: "expirado" };
    return { ok: false, error: "firma_invalida" };
  }
}

export const MENSAJES_ERROR_COBRO: Record<ErrorCobroQr, string> = {
  no_es_cobro: "Este no es un código de cobro de un negocio afiliado.",
  expirado: "El código de cobro ya expiró. Pide al negocio que genere uno nuevo.",
  firma_invalida: "Este código no es válido.",
};
