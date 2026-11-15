import { NextResponse } from "next/server";
import { z } from "zod";
import { fechaCdmx } from "@cdv/db";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Reportes del emisor: SOLO agregados (sin datos personales). */
export const GET = ruta(async (req: Request) => {
  const u = await requerirRol("emisor");
  const url = new URL(req.url);
  const hasta = Fecha.catch(fechaCdmx(new Date())).parse(url.searchParams.get("hasta"));
  const desde = Fecha.catch(fechaCdmx(new Date(Date.now() - 13 * 86_400_000))).parse(url.searchParams.get("desde"));
  const { repo } = ctx();
  const filas = await repo.reporteEmisor(u.emisor_id!, desde, hasta);
  const creds = await repo.credencialesDeEmisor(u.emisor_id!);
  return NextResponse.json({
    desde,
    hasta,
    filas,
    credenciales: {
      activas: creds.filter((c) => c.estado === "activa" && c.vigente_hasta.getTime() > Date.now()).length,
      revocadas: creds.filter((c) => c.estado === "revocada").length,
      en_revision: (await repo.colaRevision(u.emisor_id!)).length,
    },
  });
});
