import { NextResponse } from "next/server";
import { describirRegla } from "@cdv/core";
import { ctx } from "@/lib/server/contexto";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

export const GET = ruta(async () => {
  const u = await requerirRol("beneficiario");
  const { repo } = ctx();
  const creds = await repo.credencialesDeUsuario(u.id);
  const credenciales = await Promise.all(
    creds.map(async (c) => {
      const emisor = await repo.emisor(c.emisor_id);
      const convenios = (await repo.convenios({ emisorId: c.emisor_id })).filter((v) => v.tipo_beneficiario === c.tipo_beneficiario);
      return {
        id: c.id,
        estado: c.estado === "activa" && c.vigente_hasta.getTime() <= Date.now() ? "vencida" : c.estado,
        emisor: emisor?.nombre ?? c.emisor_id,
        emisor_corto: emisor?.nombre_corto ?? c.emisor_id,
        tipo_beneficiario: c.tipo_beneficiario,
        vigente_hasta: c.vigente_hasta.toISOString(),
        dispositivo_ligado: Boolean(c.dispositivo_hash),
        convenios: await Promise.all(
          convenios.map(async (v) => ({
            id: v.id,
            nombre: v.nombre,
            regla: describirRegla(v.regla),
            comercios: (await repo.comerciosDeConvenio(v.id)).map((x) => ({ id: x.id, nombre: x.nombre, direccion: x.direccion })),
          })),
        ),
      };
    }),
  );
  const verificaciones = (await repo.verificacionesDeUsuario(u.id))
    .filter((v) => v.estado === "revision_manual" || v.estado === "pendiente")
    .map((v) => ({ id: v.id, emisor_id: v.emisor_id, estado: v.estado, created_at: v.created_at.toISOString() }));
  return NextResponse.json({ credenciales, verificaciones_en_curso: verificaciones });
});
