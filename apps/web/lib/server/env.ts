import "server-only";
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    /** Habilita el selector de rol con usuarios demo (app_metadata.demo = true). */
    DEMO_MODE: bool(true),

    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

    // Pagos (Pey solo tiene producción; por defecto se cobra un monto simbólico)
    MODO_PRUEBA: bool(true),
    MONTO_PRUEBA_MXN: z.coerce.number().positive().max(10).default(0.1),
    PEY_API_KEY: z.string().min(10).optional(),
    PEY_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    PEY_BASE_URL: z.string().url().optional(),
    /** Opt-in explícito: simula Pey (sin dinero) cuando aún no hay API key. */
    PEY_SIMULADO: bool(false),

    // IA
    XAI_API_KEY: z.string().min(10).optional(),
    XAI_MODEL: z.string().default("grok-4.7"),

    /** Secreto HS256 del token de verificación de escaneo (≥ 32 caracteres). */
    VERIFICACION_SECRET: z.string().min(32),
  })
  .superRefine((e, ctx) => {
    if (!e.PEY_SIMULADO && (!e.PEY_API_KEY || !e.PEY_WEBHOOK_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["PEY_API_KEY"],
        message: "Define PEY_API_KEY y PEY_WEBHOOK_SECRET (o PEY_SIMULADO=true para desarrollo).",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cache: Env | null = null;

export function env(): Env {
  if (cache) return cache;
  // Variables vacías (`PEY_API_KEY=`) cuentan como no definidas.
  const limpio = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = EnvSchema.safeParse(limpio);
  if (!parsed.success) {
    throw new Error("Variables de entorno inválidas: " + JSON.stringify(z.flattenError(parsed.error).fieldErrors));
  }
  cache = parsed.data;
  return cache;
}

/** Llaves por emisor: ISSUER_<ID>_PRIVATE_KEY / ISSUER_<ID>_PUBLIC_KEY (base64 de PEM). */
export function llavesEmisorEnv(emisorId: string): { privada?: string; publica?: string } {
  const k = emisorId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return { privada: process.env[`ISSUER_${k}_PRIVATE_KEY`], publica: process.env[`ISSUER_${k}_PUBLIC_KEY`] };
}
