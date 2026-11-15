import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { urlCanonica } from "@/lib/dominio";

/** Refresca la sesión de Supabase en cada navegación (patrón oficial de @supabase/ssr). */
export async function middleware(req: NextRequest) {
  // Producción en Vercel: cualquier otra URL *.vercel.app redirige al dominio fijo
  // (misma sesión y mismos QR siempre). Solo navegaciones GET/HEAD; los previews no se tocan.
  if (process.env.VERCEL_ENV === "production" && (req.method === "GET" || req.method === "HEAD")) {
    const canonica = new URL(urlCanonica());
    const host = req.headers.get("host") ?? req.nextUrl.host;
    if (host !== canonica.host && host.endsWith(".vercel.app")) {
      const destino = new URL(req.nextUrl.pathname + req.nextUrl.search, canonica);
      return NextResponse.redirect(destino, 308);
    }
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) res.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = {
  // Excluye estáticos, el SW y el webhook (no usa sesión y debe recibir el cuerpo intacto).
  matcher: ["/((?!_next/static|_next/image|icons/|sw.js|swe-worker|manifest.webmanifest|api/webhooks).*)"],
};
