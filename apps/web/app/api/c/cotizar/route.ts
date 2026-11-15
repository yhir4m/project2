import { NextResponse } from "next/server";
import { z } from "zod";
import { CompraSchema } from "@cdv/core";
import { cotizar } from "@/lib/server/cobros";
import { leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("comercio");
  const { verificacion, compra } = await leerJson(req, z.object({ verificacion: z.string().min(10), compra: CompraSchema }));
  return NextResponse.json({ calculo: await cotizar(verificacion, u.comercio_id!, compra) });
});
