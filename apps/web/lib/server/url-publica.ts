import "server-only";
import { env } from "./env";

const esLocal = (host: string) => /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(host);
let cacheTunel: { url: string | null; hasta: number } | null = null;

/** En desarrollo: URL del túnel rápido de cloudflared (API local de métricas, puertos 20241–20245). */
async function urlTunelCloudflared(): Promise<string | null> {
  if (cacheTunel && cacheTunel.hasta > Date.now()) return cacheTunel.url;
  let url: string | null = null;
  for (let p = 20241; p <= 20245 && !url; p++) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/quicktunnel`, { signal: AbortSignal.timeout(400) });
      const h = ((await r.json()) as { hostname?: string }).hostname;
      if (h) url = `https://${h}`;
    } catch {
      /* puerto sin cloudflared */
    }
  }
  cacheTunel = { url, hasta: Date.now() + 30_000 };
  return url;
}

/**
 * URL pública para el enlace del QR (lo abre el CELULAR del cliente, así que no puede ser localhost):
 * 1) APP_URL si es pública  2) el host por el que llegó la petición (túnel/Vercel)
 * 3) en desarrollo, el túnel de cloudflared activo  4) el host de la petición.
 */
export async function urlPublica(req: Request): Promise<string> {
  const app = env().APP_URL;
  if (!esLocal(new URL(app).host)) return app;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (!esLocal(host)) return `${proto}://${host}`;
  if (env().NODE_ENV !== "production") {
    const tunel = await urlTunelCloudflared();
    if (tunel) return tunel;
  }
  return `${proto}://${host}`;
}
