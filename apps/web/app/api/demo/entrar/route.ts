import { NextResponse } from "next/server";
import { z } from "zod";
import { ctx } from "@/lib/server/contexto";
import { env } from "@/lib/server/env";
import { error, ipDe, leerJson, limitar, ruta } from "@/lib/server/http";
import { iniciarSesionDemo } from "@/lib/server/sesion";

export const runtime = "nodejs";

function destino(rol: string) {
  return rol === "beneficiario" ? "/b" : rol === "comercio" ? "/c" : "/e";
}

/** Selector de rol de la demo: inicia sesión (Supabase Auth) como un usuario demo. */
export const POST = ruta(async (req: Request) => {
  if (!env().DEMO_MODE) return error(404, "no_disponible", "No disponible.");
  await limitar(`demo:${ipDe(req)}`, 30, 60);
  const { usuarioId } = await leerJson(req, z.object({ usuarioId: z.string().uuid() }));
  const u = (await ctx().repo.usuariosDemo()).find((x) => x.perfil.id === usuarioId);
  if (!u) return error(404, "no_encontrado", "Usuario demo no encontrado.");
  await iniciarSesionDemo(u.email);
  return NextResponse.json({ destino: destino(u.perfil.rol) });
});

export const GET = ruta(async () => {
  if (!env().DEMO_MODE) return error(404, "no_disponible", "No disponible.");
  const { repo } = ctx();
  const [usuarios, comercios, emisores] = await Promise.all([repo.usuariosDemo(), repo.comercios(), repo.emisores()]);
  const nomComercio = new Map(comercios.map((c) => [c.id, c.nombre]));
  const nomEmisor = new Map(emisores.map((e) => [e.id, e.nombre_corto]));
  return NextResponse.json({
    usuarios: usuarios.map(({ perfil: p }) => ({
      id: p.id,
      rol: p.rol,
      nombre: p.nombre,
      detalle: p.rol === "comercio" ? nomComercio.get(p.comercio_id!) : p.rol === "emisor" ? nomEmisor.get(p.emisor_id!) : null,
    })),
  });
});
