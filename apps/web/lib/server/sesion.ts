import "server-only";
import type { Perfil, RolUsuario } from "@cdv/db";
import { supabaseServidor } from "@/lib/supabase/server";
import { ctx } from "./contexto";

export class ErrorHttp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export interface UsuarioSesion extends Perfil {
  email: string | null;
  email_confirmado: boolean;
}

/** Usuario autenticado con Supabase Auth (validado contra el servidor de Auth con getUser). */
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const perfil = await ctx().repo.perfil(data.user.id);
  if (!perfil) return null;
  return { ...perfil, email: data.user.email ?? null, email_confirmado: Boolean(data.user.email_confirmed_at) };
}

export async function requerirUsuario(): Promise<UsuarioSesion> {
  const u = await usuarioActual();
  if (!u) throw new ErrorHttp(401, "sin_sesion", "Inicia sesión para continuar.");
  return u;
}

export async function requerirRol<R extends RolUsuario>(rol: R): Promise<UsuarioSesion & { rol: R }> {
  const u = await requerirUsuario();
  if (u.rol !== rol) throw new ErrorHttp(403, "rol_incorrecto", "No tienes permiso para esta sección.");
  return u as UsuarioSesion & { rol: R };
}

/**
 * Demo: inicia sesión como un usuario demo SIN contraseña. El servidor genera un enlace mágico
 * con la API admin y lo canjea de inmediato; la sesión queda en cookies como un login normal.
 */
export async function iniciarSesionDemo(email: string) {
  const { admin } = ctx();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new ErrorHttp(500, "demo_error", "No se pudo iniciar la demo.");
  const supabase = await supabaseServidor();
  const r = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (r.error) throw new ErrorHttp(500, "demo_error", "No se pudo iniciar la demo.");
}

export async function cerrarSesion() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
}
