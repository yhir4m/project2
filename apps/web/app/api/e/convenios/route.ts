import { NextResponse } from "next/server";
import { z } from "zod";
import { ReglaConvenioSchema, describirRegla } from "@cdv/core";
import { ctx } from "@/lib/server/contexto";
import { ErrorHttp, leerJson, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const GET = ruta(async () => {
  const u = await requerirRol("emisor");
  const { repo } = ctx();
  const convenios = await repo.convenios({ emisorId: u.emisor_id!, incluirInactivos: true });
  const comercios = await repo.comercios();
  return NextResponse.json({
    convenios: await Promise.all(
      convenios.map(async (c) => ({
        ...c,
        regla_texto: describirRegla(c.regla),
        comercios: (await repo.comerciosDeConvenio(c.id)).map((x) => ({ id: x.id, nombre: x.nombre })),
      })),
    ),
    comercios: comercios.map((c) => ({ id: c.id, nombre: c.nombre })),
  });
});

const Nuevo = z.object({
  nombre: z.string().trim().min(3).max(80),
  descripcion: z.string().trim().max(200).optional(),
  tipo_beneficiario: z.string().min(1),
  regla: ReglaConvenioSchema,
});

export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("emisor");
  const body = await leerJson(req, Nuevo);
  const emisor = await ctx().repo.emisor(u.emisor_id!);
  if (!emisor?.tipos_beneficiario.includes(body.tipo_beneficiario)) {
    throw new ErrorHttp(400, "tipo_invalido", "Ese tipo de beneficiario no corresponde a tu institución.");
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const c = await ctx().repo.guardarConvenio({
    emisor_id: u.emisor_id!,
    nombre: body.nombre,
    descripcion: body.descripcion ?? null,
    tipo_beneficiario: body.tipo_beneficiario,
    regla: body.regla,
    vigente_desde: hoy,
  });
  return NextResponse.json({ convenio: c }, { status: 201 });
});
