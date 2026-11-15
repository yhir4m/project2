"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@cdv/db";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente del navegador (anon key + sesión). Solo lecturas con RLS y Realtime. */
export function supabaseNavegador() {
  cliente ??= createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return cliente;
}
