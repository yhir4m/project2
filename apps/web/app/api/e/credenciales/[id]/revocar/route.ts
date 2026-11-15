import { NextResponse } from "next/server";
import { z } from "zod";
import { ctx } from "@/lib/server/contexto";
import { error, leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Revoca una credencial. Efecto inmediato: la revocación se consulta en cada escaneo y al cobrar. */
export const POST = ruta(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("emisor");
  const { id } = await params;
  const { motivo } = await leerJson(req, z.object({ motivo: z.string().trim().min(3).max(200) }));
  const { repo } = ctx();
  const c = await repo.credencial(id);
  if (!c || c.emisor_id !== u.emisor_id) return error(404, "no_encontrada", "Credencial no encontrada.");
  if (c.estado === "revocada") return NextResponse.json({ ok: true });
  await repo.actualizarCredencial(id, { estado: "revocada", revocada_at: new Date(), motivo_revocacion: motivo });
  await repo.notificar({
    usuario_id: c.usuario_id,
    tipo: "credencial_revocada",
    titulo: "Tu credencial fue dada de baja",
    cuerpo: "Si crees que es un error, comunícate con tu institución.",
  });
  return NextResponse.json({ ok: true });
});
