import { NextResponse } from "next/server";
import { z } from "zod";
import { escanear } from "@/lib/server/escaneo";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("comercio");
  await limitar(`escaneo:${u.comercio_id}`, 60, 60);
  const { contenido } = await leerJson(req, z.object({ contenido: z.string().min(1).max(4096) }));
  const r = await escanear(contenido, u.comercio_id!);
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
});
