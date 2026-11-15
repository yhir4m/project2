import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

/** Vuelta del enlace mágico de Supabase Auth (PKCE). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const siguiente = url.searchParams.get("next");
  const destino = siguiente && siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/";
  if (code) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
}
