import { NextResponse } from "next/server";
import { procesarWebhook } from "@/lib/server/cobros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receptor de webhooks de Pey. La firma se verifica sobre el CUERPO CRUDO (`req.text()`),
 * y el pago se confirma consultando la transacción en la API (el webhook es solo aviso).
 */
export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (cuerpo.length > 64_000) return NextResponse.json({ error: "payload_grande" }, { status: 413 });
  try {
    const r = await procesarWebhook(cuerpo, req.headers);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    console.error("[webhook pey]", e);
    // 500 → Pey reintenta; el evento ya quedó registrado y el proceso es idempotente.
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}
