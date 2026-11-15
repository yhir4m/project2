import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { vistaTransaccion } from "@/lib/server/cobros";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const GET = ruta(async () => {
  const u = await requerirRol("beneficiario");
  const txs = await ctx().repo.transaccionesDeUsuario(u.id);
  return NextResponse.json({ transacciones: await Promise.all(txs.slice(0, 50).map((t) => vistaTransaccion(t, u))) });
});
