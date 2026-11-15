import { NextResponse } from "next/server";
import { z } from "zod";
import { pagarSolicitud, vistaTransaccion } from "@/lib/server/cobros";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

const Body = z.object({
  contenido: z.string().min(1).max(2048),
  credencialId: z.string().uuid(),
  dispositivoId: z.string().min(16).max(128),
  metodo: z.enum(["codi", "efectivo"]),
  revincular: z.boolean().optional(),
});

/** El cliente confirma: se aplica su descuento y se envía el cobro CoDi a su celular (o queda en efectivo). */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`pagos:${u.id}`, 10, 60);
  const b = await leerJson(req, Body);
  const tx = await pagarSolicitud(u, { ...b, revincular: Boolean(b.revincular) });
  return NextResponse.json({ transaccion: await vistaTransaccion(tx) }, { status: 201 });
});
