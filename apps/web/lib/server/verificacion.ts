import "server-only";
import {
  correoEnDominio,
  evaluarDocumento,
  finDePeriodo,
  type ExtraccionDocumento,
} from "@cdv/core";
import type { Emisor, Perfil, Verificacion } from "@cdv/db";
import { ctx } from "./contexto";
import { crearExtractor, detectarMime, TAMANO_MAX } from "./extractor";
import { ErrorHttp, type UsuarioSesion } from "./sesion";

async function emisorValido(emisorId: string): Promise<Emisor> {
  const e = await ctx().repo.emisor(emisorId);
  if (!e || !e.activo) throw new ErrorHttp(404, "emisor_no_encontrado", "Institución no encontrada.");
  return e;
}

function exigirConsentimiento(u: Perfil) {
  if (!u.consentimiento_at) throw new ErrorHttp(412, "sin_consentimiento", "Acepta el aviso de privacidad para continuar.");
}

/** Emite la credencial con vencimiento al fin del periodo del emisor (reemplaza la anterior). */
async function emitirCredencial(usuarioId: string, emisor: Emisor, verificacionId: string) {
  const { repo } = ctx();
  const tipo = emisor.tipos_beneficiario[0]!;
  const vigentes = (await repo.credencialesDeUsuario(usuarioId)).filter(
    (c) => c.emisor_id === emisor.id && c.tipo_beneficiario === tipo && c.estado === "activa",
  );
  for (const c of vigentes) await repo.actualizarCredencial(c.id, { estado: "vencida" });
  const cred = await repo.crearCredencial({
    usuario_id: usuarioId,
    emisor_id: emisor.id,
    tipo_beneficiario: tipo,
    verificacion_id: verificacionId,
    vigente_hasta: finDePeriodo(emisor.tipo_periodo),
  });
  await repo.notificar({
    usuario_id: usuarioId,
    tipo: "credencial_emitida",
    titulo: `¡Listo! Ya tienes tu credencial ${emisor.nombre_corto}`,
    cuerpo: "Úsala con tu código QR en los negocios con convenio.",
    datos: { credencial_id: cred.id },
  });
  return cred;
}

// ---------------------------------------------------------------------------
// Método A: correo institucional verificado por Supabase Auth (OTP / enlace mágico).
// El usuario inicia sesión con su correo institucional; aquí solo se valida el dominio
// del correo YA CONFIRMADO por Supabase Auth.
// ---------------------------------------------------------------------------
export async function verificarPorCorreo(u: UsuarioSesion, emisorId: string) {
  exigirConsentimiento(u);
  const emisor = await emisorValido(emisorId);
  if (!u.email || !u.email_confirmado || !correoEnDominio(u.email, emisor.dominios_correo)) {
    throw new ErrorHttp(
      409,
      "correo_no_institucional",
      `Entra con tu correo institucional (@${emisor.dominios_correo[0] ?? "…"}) para verificarte con este método.`,
    );
  }
  const v = await ctx().repo.crearVerificacion({
    usuario_id: u.id,
    emisor_id: emisor.id,
    tipo_beneficiario: emisor.tipos_beneficiario[0]!,
    metodo: "correo_institucional",
    estado: "aprobada",
    confianza: null,
    nombre_declarado: null,
    documento_path: null,
  });
  return { verificacion: v, credencial: await emitirCredencial(u.id, emisor, v.id) };
}

// ---------------------------------------------------------------------------
// Método B: documento revisado con IA (xAI Grok). Storage privado; se borra al resolver.
// ---------------------------------------------------------------------------
export async function verificarDocumento(u: Perfil, args: { emisorId: string; nombre: string; archivo: File }) {
  exigirConsentimiento(u);
  const emisor = await emisorValido(args.emisorId);
  if (args.archivo.size > TAMANO_MAX) throw new ErrorHttp(413, "archivo_grande", "La foto pesa demasiado (máx. 8 MB).");
  const bytes = new Uint8Array(await args.archivo.arrayBuffer());
  const mime = detectarMime(bytes);
  if (!mime) throw new ErrorHttp(415, "formato_no_soportado", "Sube una foto en JPG o PNG.");

  const { repo } = ctx();
  const path = `${u.id}/${globalThis.crypto.randomUUID()}`;
  await repo.subirDocumento(path, bytes, mime);

  let extraccion: ExtraccionDocumento | null = null;
  const extractor = crearExtractor();
  if (extractor) {
    try {
      extraccion = await extractor.extraer({ imagen: bytes, mimeType: mime });
    } catch (e) {
      console.error("[extractor]", e instanceof Error ? e.message : e);
    }
  }

  // Sin extracción automática (sin IA o si falló) → revisión humana, nunca rechazo automático.
  const ev = extraccion
    ? evaluarDocumento({
        extraccion,
        nombreDeclarado: args.nombre,
        tiposAceptados: emisor.tipos_documento as ExtraccionDocumento["tipo_documento"][],
        palabrasInstitucion: emisor.palabras_institucion,
      })
    : { estado: "revision_manual" as const, motivos: [extractor ? "ia_fallo" : "ia_no_configurada"] };

  const resuelta = ev.estado !== "revision_manual";
  if (resuelta) await repo.borrarDocumento(path); // el documento se borra al terminar la verificación

  const v = await repo.crearVerificacion({
    usuario_id: u.id,
    emisor_id: emisor.id,
    tipo_beneficiario: emisor.tipos_beneficiario[0]!,
    metodo: "documento_ia",
    estado: ev.estado,
    confianza: extraccion?.confianza ?? null,
    motivos: ev.motivos,
    nombre_declarado: resuelta ? null : args.nombre,
    documento_path: resuelta ? null : path,
  });

  const credencial = ev.estado === "aprobada" ? await emitirCredencial(u.id, emisor, v.id) : null;
  return { verificacion: v, credencial };
}

export async function documentoParaRevision(revisor: Perfil, verificacionId: string) {
  const { repo } = ctx();
  const v = await repo.verificacion(verificacionId);
  if (!v || v.emisor_id !== revisor.emisor_id || !v.documento_path) return null;
  return repo.descargarDocumento(v.documento_path);
}

// ---------------------------------------------------------------------------
// Revisión manual (emisor)
// ---------------------------------------------------------------------------
export async function resolverRevision(revisor: Perfil, verificacionId: string, decision: "aprobar" | "rechazar") {
  const { repo } = ctx();
  const v = await repo.verificacion(verificacionId);
  if (!v || v.emisor_id !== revisor.emisor_id) throw new ErrorHttp(404, "no_encontrada", "Verificación no encontrada.");
  if (v.estado !== "revision_manual") throw new ErrorHttp(409, "ya_resuelta", "Esta verificación ya se resolvió.");
  if (v.documento_path) await repo.borrarDocumento(v.documento_path);
  const actual: Verificacion = await repo.actualizarVerificacion(v.id, {
    estado: decision === "aprobar" ? "aprobada" : "rechazada",
    revisado_por: revisor.id,
    revisado_at: new Date(),
    documento_path: null,
    nombre_declarado: null,
  });
  if (decision === "aprobar") {
    await emitirCredencial(v.usuario_id, (await repo.emisor(v.emisor_id))!, v.id);
  } else {
    await repo.notificar({
      usuario_id: v.usuario_id,
      tipo: "verificacion_rechazada",
      titulo: "No pudimos aprobar tu documento",
      cuerpo: "Intenta con una foto más clara o un documento vigente.",
    });
  }
  return actual;
}
