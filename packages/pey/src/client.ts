import type { z } from "zod";
import {
  CrearPushNotificationSchema,
  CrearQrSchema,
  ErrorPeySchema,
  PaginaTransaccionesSchema,
  PushNotificationRespuestaSchema,
  QrRespuestaSchema,
  TransaccionPeySchema,
  type CrearPushNotification,
  type CrearQr,
  type PaginaTransacciones,
  type PushNotificationRespuesta,
  type QrRespuesta,
  type TransaccionPey,
} from "./schemas";

export const PEY_BASE_URL = "https://api.pey.mx";

export class PeyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly tipo: string | undefined,
    readonly requestId: string | undefined,
    /** true si no sabemos si Pey procesó la petición (timeout / red / 5xx en un POST). */
    readonly incierto: boolean,
  ) {
    super(message);
    this.name = "PeyError";
  }
}

export interface PeyClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  /** Reintentos SOLO para GET (lecturas idempotentes). Los POST nunca se reintentan. */
  reintentosGet?: number;
}

export class PeyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly reintentosGet: number;

  constructor(opts: PeyClientOptions) {
    if (!opts.apiKey) throw new Error("PEY_API_KEY no configurada");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? PEY_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.reintentosGet = opts.reintentosGet ?? 2;
  }

  /** `POST /codi/pn`: solicitud de cobro al celular del pagador. */
  crearPushNotification(input: CrearPushNotification): Promise<PushNotificationRespuesta> {
    return this.request(
      "POST",
      "/codi/pn",
      PushNotificationRespuestaSchema,
      CrearPushNotificationSchema.parse(input),
    );
  }

  /** `POST /codi/qr`: QR de cobro por monto fijo. */
  crearQr(input: CrearQr): Promise<QrRespuesta> {
    return this.request("POST", "/codi/qr", QrRespuestaSchema, CrearQrSchema.parse(input));
  }

  /** `GET /transaction/{id}` */
  obtenerTransaccion(id: string): Promise<TransaccionPey> {
    return this.request("GET", `/transaction/${encodeURIComponent(id)}`, TransaccionPeySchema);
  }

  /** `GET /transaction/codi/qr/{id}` */
  transaccionesDeQr(codiQrId: string, nextToken?: string): Promise<PaginaTransacciones> {
    return this.request(
      "GET",
      `/transaction/codi/qr/${encodeURIComponent(codiQrId)}${qs(nextToken)}`,
      PaginaTransaccionesSchema,
    );
  }

  /** `GET /transaction/api-key`: para conciliación. */
  transaccionesDeApiKey(nextToken?: string): Promise<PaginaTransacciones> {
    return this.request("GET", `/transaction/api-key${qs(nextToken)}`, PaginaTransaccionesSchema);
  }

  /** Busca una transacción por nuestro `txId` en metadata (conciliación de cobros inciertos). */
  async buscarPorTxId(txId: string, maxPaginas = 3): Promise<TransaccionPey | null> {
    let token: string | undefined;
    for (let i = 0; i < maxPaginas; i++) {
      const p = await this.transaccionesDeApiKey(token);
      const hit = p.items.find((t) => t.metadata?.externalMetadata?.txId === txId);
      if (hit) return hit;
      if (!p.nextToken) return null;
      token = p.nextToken;
    }
    return null;
  }

  private async request<S extends z.ZodTypeAny>(
    method: "GET" | "POST",
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<z.infer<S>> {
    const intentos = method === "GET" ? this.reintentosGet + 1 : 1;
    let ultimo: unknown;
    for (let i = 0; i < intentos; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300 * 2 ** (i - 1)));
      try {
        return await this.unaVez(method, path, schema, body);
      } catch (e) {
        ultimo = e;
        const reintentable = e instanceof PeyError && (e.status === 0 || e.status >= 500);
        if (!reintentable) throw e;
      }
    }
    throw ultimo;
  }

  private async unaVez<S extends z.ZodTypeAny>(
    method: "GET" | "POST",
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<z.infer<S>> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "Tiempo de espera agotado con Pey"
          : "Error de red con Pey";
      throw new PeyError(msg, 0, undefined, undefined, method === "POST");
    } finally {
      clearTimeout(timer);
    }

    const texto = await res.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      /* cuerpo no JSON */
    }

    if (!res.ok) {
      const err = ErrorPeySchema.safeParse(json);
      const e = err.success ? err.data.error : undefined;
      throw new PeyError(
        e?.message ?? `Pey respondió ${res.status}`,
        res.status,
        e?.type,
        e?.requestId,
        method === "POST" && res.status >= 500 && res.status !== 503,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new PeyError(
        "Respuesta de Pey con formato inesperado",
        res.status,
        "RESPUESTA_INVALIDA",
        undefined,
        method === "POST",
      );
    }
    return parsed.data;
  }
}

function qs(nextToken?: string): string {
  return nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : "";
}
