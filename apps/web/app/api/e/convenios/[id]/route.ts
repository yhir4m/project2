import { NextResponse } from "next/server";
import { z } from "zod";
import { ReglaConvenioSchema } from "@cdv/core";
import { ctx } from "@/lib/server/contexto";
import { error, leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

const Cambios = z.object({
  nombre: z.string().trim().min(3).max(80).optional(),
  descripcion: z.string().trim().max(200).nullable().optional(),
  regla: ReglaConvenioSchema.optional(),
  activo: z.boolean().optional(),
});

export const PATCH = ruta(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("emisor");
  const { id } = await params;
  const c = await ctx().repo.convenio(id);
  if (!c || c.emisor_id !== u.emisor_id) return error(404, "no_encontrado", "Convenio no encontrado.");
  const cambios = await leerJson(req, Cambios);
  return NextResponse.json({ convenio: await ctx().repo.actualizarConvenio(id, cambios) });
});
