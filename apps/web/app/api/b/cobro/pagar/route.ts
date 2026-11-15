import { NextResponse } from "next/server";
import { z } from "zod";
import { pagarDesdeQr, vistaTransaccion } from "@/lib/server/cobros";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

const Body = z.object({
  contenido: z.string().min(1).max(2048),
  cantidad: z.number().int().min(1).max(20).default(1),
  /** null = sin credencial (precio general). */
  credencialId: z.string().uuid().nullable(),
  dispositivoId: z.string().min(16).max(128),
  metodo: z.enum(["codi", "efectivo"]),
  revincular: z.boolean().optional(),
});

/** Confirma el pago del QR fijo: con descuento (credencial) o a precio general. */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`pagos:${u.id}`, 10, 60);
  const b = await leerJson(req, Body);
  const tx = await pagarDesdeQr(u, { ...b, revincular: Boolean(b.revincular) });
  return NextResponse.json({ transaccion: await vistaTransaccion(tx) }, { status: 201 });
});
