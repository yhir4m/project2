import { NextResponse } from "next/server";
import { z } from "zod";
import { CompraSchema } from "@cdv/core";
import { crearSolicitud } from "@/lib/server/cobros";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** El comercio genera una solicitud de cobro (su QR). El descuento se calcula cuando el cliente la escanea. */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("comercio");
  await limitar(`solicitudes:${u.comercio_id}`, 30, 60);
  const { compra } = await leerJson(req, z.object({ compra: CompraSchema }));
  const s = await crearSolicitud(u.comercio_id!, compra);
  return NextResponse.json({ id: s.id }, { status: 201 });
});
