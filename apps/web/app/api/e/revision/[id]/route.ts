import { NextResponse } from "next/server";
import { z } from "zod";
import { leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";
import { resolverRevision } from "@/lib/server/verificacion";

export const runtime = "nodejs";

export const POST = ruta(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("emisor");
  const { id } = await params;
  const { decision } = await leerJson(req, z.object({ decision: z.enum(["aprobar", "rechazar"]) }));
  const v = await resolverRevision(u, id, decision);
  return NextResponse.json({ estado: v.estado });
});
