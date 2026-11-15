import { NextResponse } from "next/server";
import { z } from "zod";
import { ctx } from "@/lib/server/contexto";
import { leerJson, ruta } from "@/lib/server/http";
import { requerirUsuario } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const GET = ruta(async () => {
  const u = await requerirUsuario();
  const ns = await ctx().repo.notificaciones(u.id);
  return NextResponse.json({ notificaciones: ns.map((n) => ({ ...n, created_at: n.created_at.toISOString() })) });
});

export const POST = ruta(async (req: Request) => {
  const u = await requerirUsuario();
  const { ids } = await leerJson(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional() }));
  await ctx().repo.marcarLeidas(u.id, ids);
  return NextResponse.json({ ok: true });
});
