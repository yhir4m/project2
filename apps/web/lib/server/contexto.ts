import "server-only";
import type { CryptoKey } from "jose";
import { importarLlavePrivada, importarLlavePublica, nonceAleatorio } from "@cdv/core";
import { crearClienteAdmin, RepositorioSupabase, type ClienteAdmin, type Repositorio } from "@cdv/db";
import { PeyClient, PeySimulado, type ClientePey } from "@cdv/pey";
import { env, llavesEmisorEnv } from "./env";

interface Contexto {
  admin: ClienteAdmin;
  repo: Repositorio;
  pey: ClientePey;
  simulador: PeySimulado | null;
  webhookSecret: string;
  verificacionKey: Uint8Array;
  llaves: Map<string, { privada: CryptoKey; publica: CryptoKey }>;
}

const g = globalThis as unknown as {
  __cdv?: Contexto;
  __cdvWebhook?: (b: string, h: Record<string, string>) => Promise<void>;
};

/** Dependencias del servidor (una por proceso). */
export function ctx(): Contexto {
  if (g.__cdv) return g.__cdv;
  const e = env();
  const admin = crearClienteAdmin(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);

  let pey: ClientePey;
  let simulador: PeySimulado | null = null;
  let webhookSecret: string;
  if (e.PEY_API_KEY && e.PEY_WEBHOOK_SECRET && !e.PEY_SIMULADO) {
    pey = new PeyClient({ apiKey: e.PEY_API_KEY, baseUrl: e.PEY_BASE_URL });
    webhookSecret = e.PEY_WEBHOOK_SECRET;
  } else {
    // Solo con PEY_SIMULADO=true explícito (validado en env()).
    webhookSecret = e.PEY_WEBHOOK_SECRET ?? "whsec_" + Buffer.from(nonceAleatorio(32)).toString("base64");
    simulador = new PeySimulado(webhookSecret, async (cuerpo, headers) => {
      const procesar = g.__cdvWebhook;
      if (!procesar) throw new Error("Procesador de webhooks no registrado");
      setTimeout(() => void procesar(cuerpo, headers).catch((err) => console.error("[sim webhook]", err)), 600);
    });
    pey = simulador;
    console.warn("[cdv] PEY_SIMULADO=true: los cobros NO van a Pey.");
  }

  g.__cdv = {
    admin,
    repo: new RepositorioSupabase(admin),
    pey,
    simulador,
    webhookSecret,
    verificacionKey: new TextEncoder().encode(e.VERIFICACION_SECRET),
    llaves: new Map(),
  };
  return g.__cdv;
}

export function registrarProcesadorWebhook(fn: (cuerpo: string, h: Record<string, string>) => Promise<void>) {
  g.__cdvWebhook = fn;
}

/** Llaves Ed25519 del emisor desde el entorno. La privada nunca sale del servidor. */
export async function llavesEmisor(emisorId: string) {
  const c = ctx();
  const hit = c.llaves.get(emisorId);
  if (hit) return hit;
  const { privada, publica } = llavesEmisorEnv(emisorId);
  if (!privada || !publica) {
    throw new Error(`Faltan ISSUER_${emisorId.toUpperCase()}_PRIVATE_KEY / _PUBLIC_KEY (pnpm keys:generate -- ${emisorId}).`);
  }
  const par = { privada: await importarLlavePrivada(privada), publica: await importarLlavePublica(publica) };
  c.llaves.set(emisorId, par);
  return par;
}

/** Resolver de llaves públicas: solo emisores registrados y activos. */
export async function resolverLlavePublica(emisorId: string): Promise<CryptoKey | null> {
  const emisor = await ctx().repo.emisor(emisorId);
  if (!emisor || !emisor.activo) return null;
  return (await llavesEmisor(emisorId)).publica;
}
