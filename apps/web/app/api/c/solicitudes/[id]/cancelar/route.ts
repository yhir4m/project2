import { NextResponse } from "next/server";
import { cancelarSolicitud } from "@/lib/server/cobros";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const POST = ruta(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("comercio");
  const { id } = await params;
  const s = await cancelarSolicitud(id, u.comercio_id!);
  return NextResponse.json({ estado: s.estado });
});
