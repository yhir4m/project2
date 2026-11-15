import { NextResponse } from "next/server";
import { confirmarEfectivo } from "@/lib/server/cobros";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** El comercio confirma que recibió el efectivo. */
export const POST = ruta(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("comercio");
  const { id } = await params;
  const tx = await confirmarEfectivo(id, u.comercio_id!);
  return NextResponse.json({ estado: tx.estado });
});
