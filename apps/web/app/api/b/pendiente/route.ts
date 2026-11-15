import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Cobro en curso más reciente del beneficiario (para saltar de "Mi QR" a "Pago pendiente"). */
export const GET = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  const desde = Number(new URL(req.url).searchParams.get("desde") ?? 0);
  const tx = (await ctx().repo.transaccionesDeUsuario(u.id)).find(
    (t) => t.created_at.getTime() >= desde && (["creando", "pendiente", "incierta"].includes(t.estado) || t.metodo === "efectivo"),
  );
  return NextResponse.json({ transaccion: tx ? { id: tx.id, estado: tx.estado, metodo: tx.metodo } : null }, { headers: { "Cache-Control": "no-store" } });
});
