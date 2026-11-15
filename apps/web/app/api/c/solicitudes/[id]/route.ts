import { NextResponse } from "next/server";
import { ctx } from "@/lib/server/contexto";
import { refrescarTransaccion, solicitudDeComercio, vistaTransaccion } from "@/lib/server/cobros";
import { ruta } from "@/lib/server/http";
import { requerirRol } from "@/lib/server/sesion";

export const runtime = "nodejs";

/** Estado en vivo de la solicitud del comercio: QR (si sigue abierta) y transacción (cuando el cliente paga). */
export const GET = ruta(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requerirRol("comercio");
  const { id } = await params;
  const s = await solicitudDeComercio(id, u.comercio_id!);
  let tx = s.transaccion_id ? await ctx().repo.transaccion(s.transaccion_id) : null;
  if (tx) tx = await refrescarTransaccion(tx);
  const actual = tx && tx.estado !== s.estado ? ((await ctx().repo.solicitud(s.id)) ?? s) : s;
  return NextResponse.json(
    {
      solicitud: {
        id: actual.id,
        estado: actual.estado,
        compra: actual.compra,
        total_centavos: actual.total_centavos,
        expira_en: actual.expira_en.toISOString(),
      },
      qr: null,
      transaccion: tx ? await vistaTransaccion(tx) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
