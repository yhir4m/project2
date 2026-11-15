import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { MENSAJES_ERROR_QR, describirRegla, verificarQr, type ErrorQr } from "@cdv/core";
import { ctx, resolverLlavePublica } from "./contexto";
import { estadoParaVerificacion } from "./credenciales";
import { ErrorHttp } from "./sesion";

/** Vigencia de una verificación de escaneo para capturar el monto y cobrar. */
export const VERIFICACION_TTL_SEG = 5 * 60;

const ClaimsVerificacion = z.object({
  typ: z.literal("cdv-ver"),
  com: z.string(),
  cid: z.string(),
  cnv: z.string(),
  jti: z.string(),
  exp: z.number(),
});
export type VerificacionEscaneo = z.infer<typeof ClaimsVerificacion>;

export type ResultadoEscaneo =
  | {
      ok: true;
      verificacion: string;
      expira_en: string;
      emisor: string;
      tipo_beneficiario: string;
      convenio: { id: string; nombre: string; descripcion: string | null; regla: string };
      cobro_al_celular: boolean;
    }
  | { ok: false; error: ErrorQr; mensaje: string };

/**
 * El comercio escanea → se verifica firma, vigencia, revocación, dispositivo, convenio y nonce.
 * Respuesta mínima: NO incluye nombre, edad ni datos del beneficiario; solo "elegible: convenio X".
 * Si es válido, se entrega un token de verificación de un solo uso (5 min) para crear el cobro.
 */
export async function escanear(contenido: string, comercioId: string): Promise<ResultadoEscaneo> {
  const { repo, verificacionKey } = ctx();
  const r = await verificarQr(contenido, comercioId, {
    resolverLlave: resolverLlavePublica,
    obtenerCredencial: async (id) => {
      const c = await repo.credencial(id);
      return c ? estadoParaVerificacion(c) : null;
    },
    buscarConvenio: async (a) => {
      const c = await repo.buscarConvenio(a);
      return c ? { id: c.id, nombre: c.nombre } : null;
    },
    consumirNonce: (n, exp) => repo.consumirNonce(n, exp),
  });
  if (!r.ok) return { ok: false, error: r.error, mensaje: MENSAJES_ERROR_QR[r.error] };

  const convenio = (await repo.convenio(r.convenio.id))!;
  const emisor = await repo.emisor(r.claims.iss);
  const credencial = (await repo.credencial(r.claims.cid))!;
  const perfil = await repo.perfil(credencial.usuario_id);

  const exp = Math.floor(Date.now() / 1000) + VERIFICACION_TTL_SEG;
  const verificacion = await new SignJWT({ typ: "cdv-ver", com: comercioId, cid: r.claims.cid, cnv: convenio.id })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(r.claims.jti) // mismo nonce del QR: una lectura → un cobro
    .setExpirationTime(exp)
    .sign(verificacionKey);

  return {
    ok: true,
    verificacion,
    expira_en: new Date(exp * 1000).toISOString(),
    emisor: emisor?.nombre_corto ?? r.claims.iss,
    tipo_beneficiario: r.claims.tb,
    convenio: { id: convenio.id, nombre: convenio.nombre, descripcion: convenio.descripcion, regla: describirRegla(convenio.regla) },
    // Solo un booleano: el comercio nunca ve el número.
    cobro_al_celular: Boolean(perfil?.celular),
  };
}

export async function leerVerificacion(token: string, comercioId: string): Promise<VerificacionEscaneo> {
  try {
    const { payload } = await jwtVerify(token, ctx().verificacionKey, { algorithms: ["HS256"] });
    const v = ClaimsVerificacion.parse(payload);
    if (v.com !== comercioId) throw new Error("comercio");
    return v;
  } catch {
    throw new ErrorHttp(410, "verificacion_vencida", "La verificación expiró. Escanea el código de nuevo.");
  }
}
