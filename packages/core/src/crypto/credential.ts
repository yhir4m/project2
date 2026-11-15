import { SignJWT, jwtVerify, decodeProtectedHeader, errors, type CryptoKey } from "jose";
import { z } from "zod";
import { ALG, type ResolverLlavePublica } from "./keys";

/**
 * Credencial digital (JWS compacto, EdDSA).
 * Minimización: NO lleva nombre, edad, CURP ni correo. Solo el seudónimo y el convenio.
 */
export const ClaimsCredencialSchema = z.object({
  typ: z.literal("cdv-cred"),
  iss: z.string().min(1), // id del emisor
  sub: z.string().min(1), // seudónimo del beneficiario
  jti: z.string().min(1), // id de la credencial (para revocación)
  tb: z.string().min(1), // tipo de beneficiario: estudiante | adulto_mayor | ...
  iat: z.number().int(),
  exp: z.number().int(), // fin del periodo
});
export type ClaimsCredencial = z.infer<typeof ClaimsCredencialSchema>;

export interface EmitirCredencialInput {
  emisorId: string;
  seudonimo: string;
  credencialId: string;
  tipoBeneficiario: string;
  vigenteHasta: Date;
  ahora?: Date;
}

export async function firmarCredencial(
  input: EmitirCredencialInput,
  llavePrivada: CryptoKey,
): Promise<string> {
  const iat = Math.floor((input.ahora ?? new Date()).getTime() / 1000);
  const exp = Math.floor(input.vigenteHasta.getTime() / 1000);
  if (exp <= iat) throw new RangeError("La vigencia debe ser futura");
  return new SignJWT({ typ: "cdv-cred", tb: input.tipoBeneficiario })
    .setProtectedHeader({ alg: ALG, kid: input.emisorId, typ: "JWT" })
    .setIssuer(input.emisorId)
    .setSubject(input.seudonimo)
    .setJti(input.credencialId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(llavePrivada);
}

export type ErrorFirma = "firma_invalida" | "expirado" | "emisor_desconocido" | "formato_invalido";

export type ResultadoVerificacion<T> = { ok: true; claims: T } | { ok: false; error: ErrorFirma };

/** Verifica un JWS del sistema: firma Ed25519, emisor conocido, expiración y forma de los claims. */
export async function verificarJws<T>(
  token: string,
  resolver: ResolverLlavePublica,
  schema: z.ZodType<T>,
  opciones: { ahora?: Date; toleranciaSeg?: number } = {},
): Promise<ResultadoVerificacion<T>> {
  let kid: string | undefined;
  try {
    const h = decodeProtectedHeader(token);
    if (h.alg !== ALG) return { ok: false, error: "firma_invalida" };
    kid = h.kid;
  } catch {
    return { ok: false, error: "formato_invalido" };
  }
  if (!kid) return { ok: false, error: "formato_invalido" };

  const llave = await resolver(kid);
  if (!llave) return { ok: false, error: "emisor_desconocido" };

  try {
    const { payload } = await jwtVerify(token, llave, {
      algorithms: [ALG],
      issuer: kid,
      currentDate: opciones.ahora,
      clockTolerance: opciones.toleranciaSeg ?? 5,
      requiredClaims: ["exp", "iat", "iss"],
    });
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return { ok: false, error: "formato_invalido" };
    return { ok: true, claims: parsed.data };
  } catch (e) {
    if (e instanceof errors.JWTExpired) return { ok: false, error: "expirado" };
    if (e instanceof errors.JWSSignatureVerificationFailed)
      return { ok: false, error: "firma_invalida" };
    if (e instanceof errors.JWTClaimValidationFailed)
      return { ok: false, error: "formato_invalido" };
    return { ok: false, error: "firma_invalida" };
  }
}

export function verificarCredencial(
  token: string,
  resolver: ResolverLlavePublica,
  opciones?: { ahora?: Date },
): Promise<ResultadoVerificacion<ClaimsCredencial>> {
  return verificarJws(token, resolver, ClaimsCredencialSchema, opciones);
}
