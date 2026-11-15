import { NextResponse } from "next/server";
import { z } from "zod";
import { ctx } from "@/lib/server/contexto";
import { crearQr, qrDeProducto } from "@/lib/server/cobros";
import { leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";
import { urlPublica } from "@/lib/server/url-publica";

export const runtime = "nodejs";

/** QR fijos del negocio (uno por producto/servicio, con precio fijo). */
export const GET = ruta(async (req: Request) => {
  const u = await requerirRol("comercio");
  const base = await urlPublica(req);
  const productos = await ctx().repo.productos(u.comercio_id!, { incluirInactivos: true });
  return NextResponse.json({
    qrs: productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio_centavos: p.precio_centavos,
      activo: p.activo,
      url: qrDeProducto(p.id, base),
    })),
  });
});

/** Crea un QR fijo. El precio se define aquí una sola vez. */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("comercio");
  const b = await leerJson(
    req,
    z.object({ nombre: z.string().trim().min(2).max(80), precio_centavos: z.number().int().min(100).max(5_000_000) }),
  );
  const p = await crearQr(u.comercio_id!, b.nombre, b.precio_centavos);
  return NextResponse.json({ id: p.id }, { status: 201 });
});
