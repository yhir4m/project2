import "server-only";
import {
  firmarCredencial,
  firmarQr,
  nonceAleatorio,
  sha256Base64url,
  verificarCredencial,
  type CredencialEstado,
} from "@cdv/core";
import type { Credencial } from "@cdv/db";
import { ctx, llavesEmisor, resolverLlavePublica } from "./contexto";
import { ErrorHttp } from "./sesion";

/** Devuelve el JWS de la credencial; lo firma (o re-firma si la llave cambió) en el servidor. */
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
 * Emite un QR dinámico (45 s) para la credencial del usuario autenticado.
 * Liga la credencial al primer dispositivo que la usa (hash del id de dispositivo).
 */
export async function emitirQr(usuarioId: string, credencialId: string, dispositivoId: string) {
  const { repo } = ctx();
  const c = await repo.credencial(credencialId);
  if (!c || c.usuario_id !== usuarioId) throw new ErrorHttp(404, "credencial_no_encontrada", "No encontramos tu credencial.");
  if (c.estado === "revocada") throw new ErrorHttp(409, "credencial_revocada", "Tu credencial fue dada de baja.");
  if (c.estado === "vencida" || c.vigente_hasta.getTime() <= Date.now()) {
    throw new ErrorHttp(409, "credencial_vencida", "Tu credencial venció. Verifícate de nuevo.");
  }

  const dispositivoHash = await sha256Base64url(`cdv-dev:${dispositivoId}`);
  if (!c.dispositivo_hash) {
    await repo.actualizarCredencial(c.id, { dispositivo_hash: dispositivoHash });
  } else if (c.dispositivo_hash !== dispositivoHash) {
    throw new ErrorHttp(409, "otro_dispositivo", "Esta credencial está ligada a otro teléfono.");
  }

  const { privada } = await llavesEmisor(c.emisor_id);
  return firmarQr(
    {
      emisorId: c.emisor_id,
      seudonimo: c.seudonimo,
      credencialId: c.id,
      tipoBeneficiario: c.tipo_beneficiario,
      dispositivoHash,
      nonce: nonceAleatorio(18),
      credencialVenceEn: c.vigente_hasta,
    },
    privada,
  );
}

export function estadoParaVerificacion(c: Credencial): CredencialEstado {
  return {
    id: c.id,
    emisor_id: c.emisor_id,
    seudonimo: c.seudonimo,
    estado: c.estado,
    vigente_hasta: c.vigente_hasta,
    dispositivo_hash: c.dispositivo_hash,
  };
}
