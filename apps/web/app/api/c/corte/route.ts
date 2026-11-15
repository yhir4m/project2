import { NextResponse } from "next/server";
import { fechaCdmx } from "@cdv/db";
import { ctx } from "@/lib/server/contexto";
import { vistaTransaccion } from "@/lib/server/cobros";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Corte del día (hora de Ciudad de México). */
export const GET = ruta(async () => {
  const u = await requerirRol("comercio");
  const hoy = fechaCdmx(new Date());
  const txs = (await ctx().repo.transaccionesDeComercio(u.comercio_id!, new Date(Date.now() - 36 * 3600_000))).filter(
    (t) => fechaCdmx(t.created_at) === hoy,
  );
  const pagadas = txs.filter((t) => t.estado === "pagada");
  const suma = (f: (t: (typeof txs)[number]) => number, l = pagadas) => l.reduce((s, t) => s + f(t), 0);
  return NextResponse.json({
    fecha: hoy,
    resumen: {
      ventas: pagadas.length,
      total_centavos: suma((t) => t.monto_final_centavos),
      descuento_centavos: suma((t) => t.descuento_centavos),
      codi_centavos: suma((t) => t.monto_final_centavos, pagadas.filter((t) => t.metodo === "codi")),
      efectivo_centavos: suma((t) => t.monto_final_centavos, pagadas.filter((t) => t.metodo === "efectivo")),
      no_completadas: txs.length - pagadas.length,
    },
    transacciones: await Promise.all(txs.map((t) => vistaTransaccion(t, u))),
  });
});
