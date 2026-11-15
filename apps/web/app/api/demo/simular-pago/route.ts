import { NextResponse } from "next/server";
import { z } from "zod";
import { ctx } from "@/lib/server/contexto";
import { puedeVerTransaccion } from "@/lib/server/cobros";
import { error, leerJson, ruta } from "@/lib/server/http";
import { requerirUsuario } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Solo con Pey SIMULADO: el beneficiario "autoriza en su banco". Dispara un webhook firmado. */
export const POST = ruta(async (req: Request) => {
  const { simulador, repo } = ctx();
  if (!simulador) return error(404, "no_disponible", "Solo disponible con Pey simulado.");
  const u = await requerirUsuario();
  const { transaccionId } = await leerJson(req, z.object({ transaccionId: z.string().uuid() }));
  const tx = await repo.transaccion(transaccionId);
  if (!tx || !(await puedeVerTransaccion(tx, u))) return error(404, "no_encontrada", "No encontramos el cobro.");
  await simulador.autorizar(tx.pey_id ? { transactionId: tx.pey_id } : { codiQrId: tx.pey_codi_id ?? undefined });
  return NextResponse.json({ ok: true });
});
