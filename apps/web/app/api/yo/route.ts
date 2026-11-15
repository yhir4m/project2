import { NextResponse } from "next/server";
import { z } from "zod";
import { enmascararCelular, normalizarCelularMx } from "@cdv/core";
import type { Perfil } from "@cdv/db";
import { ctx } from "@/lib/server/contexto";
import { env } from "@/lib/server/env";
import { ErrorHttp, leerJson, ruta } from "@/lib/server/http";
import { requerirUsuario, usuarioActual } from "@/lib/server/sesion";

export const runtime = "nodejs";

async function vista(p: Perfil) {
  const { repo } = ctx();
  const e = env();
  return {
    id: p.id,
    rol: p.rol,
    nombre: p.nombre,
    celular: p.celular ? enmascararCelular(p.celular) : null,
    tiene_celular: Boolean(p.celular),
    letra_grande: p.letra_grande,
    consentimiento: Boolean(p.consentimiento_at),
    comercio: p.comercio_id ? await repo.comercio(p.comercio_id) : null,
    emisor: p.emisor_id ? await repo.emisor(p.emisor_id) : null,
    email: (p as { email?: string | null }).email ?? null,
    app: { modo_prueba: e.MODO_PRUEBA, monto_prueba: e.MONTO_PRUEBA_MXN, pey_simulado: e.PEY_SIMULADO, demo: e.DEMO_MODE },
  };
}
export type VistaYo = Awaited<ReturnType<typeof vista>>;

export const GET = ruta(async () => {
  const u = await usuarioActual();
  if (!u) return NextResponse.json({ usuario: null, app: { modo_prueba: env().MODO_PRUEBA, demo: env().DEMO_MODE } });
  return NextResponse.json({ usuario: await vista(u) });
});

const Cambios = z.object({
  nombre: z.string().trim().min(1).max(60).optional(),
  celular: z.string().max(20).nullable().optional(),
  letra_grande: z.boolean().optional(),
  consentimiento: z.literal(true).optional(),
});

export const PATCH = ruta(async (req: Request) => {
  const u = await requerirUsuario();
  const c = await leerJson(req, Cambios);
  let celular: string | null | undefined;
  if (c.celular !== undefined) {
    if (u.rol !== "beneficiario") throw new ErrorHttp(403, "no_permitido", "Solo beneficiarios registran celular.");
    celular = c.celular === null || c.celular === "" ? null : normalizarCelularMx(c.celular);
    if (celular === null && c.celular) throw new ErrorHttp(400, "celular_invalido", "Escribe tu celular a 10 dígitos.");
  }
  const p = await ctx().repo.actualizarPerfil(u.id, {
    ...(c.nombre !== undefined ? { nombre: c.nombre } : {}),
    ...(celular !== undefined ? { celular } : {}),
    ...(c.letra_grande !== undefined ? { letra_grande: c.letra_grande } : {}),
    ...(c.consentimiento ? { consentimiento_at: new Date() } : {}),
  });
  return NextResponse.json({ usuario: await vista({ ...p, email: u.email } as typeof u) });
});
