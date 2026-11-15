import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Lista de credenciales del emisor: SOLO seudónimo y estado (sin nombre ni contacto). */
export const GET = ruta(async () => {
  const u = await requerirRol("emisor");
  const creds = await ctx().repo.credencialesDeEmisor(u.emisor_id!);
  return NextResponse.json({
    credenciales: creds.map((c) => ({
      id: c.id,
      seudonimo: c.seudonimo,
      tipo_beneficiario: c.tipo_beneficiario,
      estado: c.estado === "activa" && c.vigente_hasta.getTime() <= Date.now() ? "vencida" : c.estado,
      vigente_hasta: c.vigente_hasta.toISOString(),
      revocada_at: c.revocada_at?.toISOString() ?? null,
      motivo_revocacion: c.motivo_revocacion,
      created_at: c.created_at.toISOString(),
    })),
  });
});
