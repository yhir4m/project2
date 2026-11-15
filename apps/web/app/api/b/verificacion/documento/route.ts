import { NextResponse } from "next/server";
import { z } from "zod";
import { ErrorHttp, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";
import { verificarDocumento } from "@/lib/server/verificacion";

export const runtime = "nodejs";
export const maxDuration = 60;

const Campos = z.object({ emisorId: z.string().min(1), nombre: z.string().trim().min(5).max(100) });

export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`doc:${u.id}`, 5, 3600);
  const form = await req.formData().catch(() => {
    throw new ErrorHttp(400, "formulario_invalido", "No recibimos la foto.");
  });
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) throw new ErrorHttp(400, "sin_archivo", "Toma o sube una foto del documento.");
  const campos = Campos.parse({ emisorId: form.get("emisorId"), nombre: form.get("nombre") });
  const { verificacion, credencial } = await verificarDocumento(u, { ...campos, archivo });
  return NextResponse.json({ estado: verificacion.estado, motivos: verificacion.motivos, credencial_id: credencial?.id ?? null });
});
