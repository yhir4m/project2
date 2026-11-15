import { error, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";
import { documentoParaRevision } from "@/lib/server/verificacion";

export const runtime = "nodejs";

/** Documento temporal para el revisor del emisor (proxy de Storage privado; nunca URL pública). */
export const GET = ruta(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("emisor");
  const { id } = await params;
  const doc = await documentoParaRevision(u, id);
  if (!doc) return error(404, "no_encontrado", "Documento no disponible.");
  return new Response(Buffer.from(doc.bytes), {
    headers: { "Content-Type": doc.mime, "Cache-Control": "private, no-store", "Content-Disposition": "inline" },
  });
});
