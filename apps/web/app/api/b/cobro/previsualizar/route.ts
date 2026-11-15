import { NextResponse } from "next/server";
import { z } from "zod";
import { previsualizarPago } from "@/lib/server/cobros";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** El cliente escaneó el QR del comercio: se muestra el desglose con su descuento (aún no se cobra). */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`escaneo:${u.id}`, 30, 60);
  const { contenido } = await leerJson(req, z.object({ contenido: z.string().min(1).max(2048) }));
  return NextResponse.json(await previsualizarPago(u, contenido));
});
