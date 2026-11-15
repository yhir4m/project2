import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";

/** Catálogo público de instituciones (para el onboarding). */
export const GET = ruta(async () => {
  const emisores = await ctx().repo.emisores();
  return NextResponse.json({
    emisores: emisores.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      nombre_corto: e.nombre_corto,
      metodos: [...(e.dominios_correo.length ? (["correo_institucional"] as const) : []), "documento_ia" as const],
      dominio: e.dominios_correo[0] ?? null,
      documentos: e.tipos_documento,
    })),
  });
});
