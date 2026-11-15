import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { puedeVerTransaccion, refrescarTransaccion, vistaTransaccion } from "@/lib/server/cobros";
import { error, ruta } from "@/lib/server/http";
import { requerirUsuario } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Estado en vivo de un cobro (el cliente consulta cada ~1.5 s; sustituto de Supabase Realtime). */
export const GET = ruta(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirUsuario();
  const { id } = await params;
  const tx = await ctx().repo.transaccion(id);
  if (!tx || !(await puedeVerTransaccion(tx, u))) return error(404, "no_encontrada", "No encontramos el cobro.");
  const actual = await refrescarTransaccion(tx);
  return NextResponse.json({ transaccion: await vistaTransaccion(actual) }, { headers: { "Cache-Control": "no-store" } });
});
