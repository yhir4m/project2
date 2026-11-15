import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const GET = ruta(async () => {
  const u = await requerirRol("comercio");
  const productos = await ctx().repo.productos(u.comercio_id!);
  return NextResponse.json({ productos: productos.map(({ sku, nombre, precio_centavos }) => ({ sku, nombre, precio_centavos })) });
});
