import { NextResponse } from "next/server";
import { z } from "zod";
import { CompraSchema } from "@cdv/core";
import { crearCobro, vistaTransaccion } from "@/lib/server/cobros";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

const Body = z.object({
  verificacion: z.string().min(10),
  compra: CompraSchema,
  metodo: z.enum(["codi", "efectivo"]),
});

/** Crea el cobro. El monto lo calcula el servidor; el cliente solo envía la compra. */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("comercio");
  await limitar(`cobros:${u.comercio_id}`, 20, 60);
  const body = await leerJson(req, Body);
  const tx = await crearCobro({ token: body.verificacion, comercioId: u.comercio_id!, compra: body.compra, metodo: body.metodo });
  return NextResponse.json({ transaccion: await vistaTransaccion(tx, u) }, { status: 201 });
});
