import { NextResponse } from "next/server";
import { z } from "zod";
import { emitirQr } from "@/lib/server/credenciales";
import { env } from "@/lib/server/env";
import { leerJson, limitar, ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

const Body = z.object({
  credencialId: z.string().uuid(),
  dispositivoId: z.string().min(16).max(128),
  revincular: z.boolean().optional(),
});

/** Emite un QR firmado de 45 s. Solo la sesión dueña de la credencial puede pedirlo. */
export const POST = ruta(async (req: Request) => {
  const u = await requerirRol("beneficiario");
  await limitar(`qr:${u.id}`, 20, 60);
  const { credencialId, dispositivoId, revincular } = await leerJson(req, Body);
  // Revincular el dispositivo solo en la demo (se cambia de navegador/teléfono seguido).
  const { token, exp } = await emitirQr(u.id, credencialId, dispositivoId, Boolean(revincular && env().DEMO_MODE));
  return NextResponse.json({ token, expira_en: new Date(exp * 1000).toISOString() }, { headers: { "Cache-Control": "no-store" } });
});
