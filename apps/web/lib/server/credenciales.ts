import "server-only";
import { firmarCredencial, sha256Base64url, verificarCredencial } from "@cdv/core";
import type { Credencial } from "@cdv/db";
import { ctx, llavesEmisor, resolverLlavePublica } from "./contexto";
import { env } from "./env";
import { ErrorHttp } from "./sesion";

/** JWS de la credencial (EdDSA del emisor). Se firma en el servidor la primera vez que se necesita. */
export async function jwsDeCredencial(c: Credencial): Promise<string> {
  if (c.jws) {
    const ok = await verificarCredencial(c.jws, resolverLlavePublica);
    if (ok.ok) return c.jws;
  }
  const { privada } = await llavesEmisor(c.emisor_id);
  const jws = await firmarCredencial(
    {
      emisorId: c.emisor_id,
      seudonimo: c.seudonimo,
      credencialId: c.id,
      tipoBeneficiario: c.tipo_beneficiario,
      vigenteHasta: c.vigente_hasta,
    },
    privada,
  );
  await ctx().repo.actualizarCredencial(c.id, { jws });
  return jws;
}

/**
 * Valida que la credencial pueda usarse para pagar AHORA:
 * dueño = sesión, firma del emisor válida y consistente con la BD, no revocada ni vencida,
 * y usada desde el teléfono al que está ligada (se liga en el primer uso).
 */
export async function validarCredencialParaPago(
  usuarioId: string,
  credencialId: string,
  dispositivoId: string,
  revincular: boolean,
): Promise<Credencial> {
  const { repo } = ctx();
  const c = await repo.credencial(credencialId);
  if (!c || c.usuario_id !== usuarioId) throw new ErrorHttp(404, "credencial_no_encontrada", "No encontramos tu credencial.");
  if (c.estado === "revocada") throw new ErrorHttp(409, "credencial_revocada", "Tu credencial fue dada de baja.");
  if (c.estado === "vencida" || c.vigente_hasta.getTime() <= Date.now()) {
    throw new ErrorHttp(409, "credencial_vencida", "Tu credencial venció. Verifícate de nuevo.");
  }

  // Firma del emisor (Ed25519) y coherencia con el registro.
  const v = await verificarCredencial(await jwsDeCredencial(c), resolverLlavePublica);
  if (!v.ok || v.claims.jti !== c.id || v.claims.sub !== c.seudonimo || v.claims.iss !== c.emisor_id) {
    throw new ErrorHttp(409, "credencial_invalida", "Tu credencial no es válida. Verifícate de nuevo.");
  }

  // Ligada al dispositivo. Revincular solo se permite en la demo.
  const hash = await sha256Base64url(`cdv-dev:${dispositivoId}`);
  if (!c.dispositivo_hash || (revincular && env().DEMO_MODE && c.dispositivo_hash !== hash)) {
    return repo.actualizarCredencial(c.id, { dispositivo_hash: hash });
  }
  if (c.dispositivo_hash !== hash) {
    throw new ErrorHttp(409, "otro_dispositivo", "Tu credencial está ligada a otro teléfono. Verifícate de nuevo en este teléfono.");
  }
  return c;
}
