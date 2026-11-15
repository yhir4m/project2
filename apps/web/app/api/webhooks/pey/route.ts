import { NextResponse } from "next/server";
import { procesarWebhook } from "@/lib/server/cobros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receptor de webhooks de Pey. La firma se verifica sobre el CUERPO CRUDO (`req.text()`),
 * y el pago se confirma consultando la transacción en la API (el webhook es solo aviso).
 */
/** Abrir la URL en el navegador (GET) solo confirma que el túnel llega a la app; no procesa nada. */
export function GET() {
  return NextResponse.json(
    { ok: true, mensaje: "Endpoint de webhooks de Pey activo. Solo acepta POST firmados por Pey." },
    { headers: { "Cache-Control": "no-store" } },
  );
}

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
