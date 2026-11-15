import "server-only";
import { redirect } from "next/navigation";
import type { RolUsuario } from "@cdv/db";
import { usuarioActual } from "./sesion";

/** Protege una sección por rol en el servidor (además de la verificación en cada endpoint). */
export async function guardiaRol(rol: RolUsuario) {
  const u = await usuarioActual();
  if (!u) redirect("/");
  if (u.rol !== rol) redirect(u.rol === "beneficiario" ? "/b" : u.rol === "comercio" ? "/c" : "/e");
  return u;
}
