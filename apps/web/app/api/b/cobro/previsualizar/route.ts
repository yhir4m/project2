import { NextResponse } from "next/server";
import { z } from "zod";
import { previsualizarPago } from "@/lib/server/cobros";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Escaneó un QR fijo: precio del QR y lo que paga según su perfil (aún no se cobra). */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`escaneo:${u.id}`, 60, 60);
  const { contenido, cantidad } = await leerJson(
    req,
    z.object({ contenido: z.string().min(1).max(2048), cantidad: z.number().int().min(1).max(20).default(1) }),
  );
  return NextResponse.json(await previsualizarPago(u, contenido, cantidad));
});
