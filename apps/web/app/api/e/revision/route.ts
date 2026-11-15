import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const GET = ruta(async () => {
  const u = await requerirRol("emisor");
  const cola = await ctx().repo.colaRevision(u.emisor_id!);
  return NextResponse.json({
    cola: cola.map((v) => ({
      id: v.id,
      nombre_declarado: v.nombre_declarado,
      tipo_beneficiario: v.tipo_beneficiario,
      confianza: v.confianza,
      motivos: v.motivos,
      tiene_documento: Boolean(v.documento_path),
      created_at: v.created_at.toISOString(),
    })),
  });
});
