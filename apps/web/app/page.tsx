import { redirect } from "next/navigation";
import { env } from "@/lib/server/env";
import { usuarioActual } from "@/lib/server/sesion";
import { SelectorRol } from "./selector-rol";

export const dynamic = "force-dynamic";

/** Inicio: elegir rol (solo para la demo). Si ya hay sesión, va directo a su sección. */
export default async function Inicio() {
  const u = await usuarioActual();
  if (u) redirect(u.rol === "beneficiario" ? "/b" : u.rol === "comercio" ? "/c" : "/e");
  return <SelectorRol demo={env().DEMO_MODE} />;
}
