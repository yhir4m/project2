import { NextResponse } from "next/server";
import { z } from "zod";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";
import { verificarPorCorreo } from "@/lib/server/verificacion";

export const runtime = "nodejs";

/** Método A: aprueba si el correo de la sesión (confirmado por Supabase Auth) es del dominio del emisor. */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`verif-correo:${u.id}`, 10, 600);
  const { emisorId } = await leerJson(req, z.object({ emisorId: z.string().min(1) }));
  const { credencial } = await verificarPorCorreo(u, emisorId);
  return NextResponse.json({ estado: "aprobada", credencial_id: credencial.id });
});
