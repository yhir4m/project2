import { NextResponse } from "next/server";
import { z } from "zod";
import { ctx } from "@/lib/server/contexto";
import { error, leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Activar/desactivar un QR fijo. El precio no se edita: para cambiarlo se crea otro QR. */
export const PATCH = ruta(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("comercio");
  const { id } = await params;
  const p = await ctx().repo.producto(id);
  if (!p || p.comercio_id !== u.comercio_id) return error(404, "no_encontrado", "QR no encontrado.");
  const { activo } = await leerJson(req, z.object({ activo: z.boolean() }));
  await ctx().repo.activarProducto(id, activo);
  return NextResponse.json({ ok: true });
});
