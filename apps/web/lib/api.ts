/** Cliente HTTP mínimo: lanza `ErrorApi` con el mensaje claro que manda el servidor. */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly datos?: unknown,
  ) {
    super(mensaje);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ErrorApi(0, "sin_conexion", "Sin conexión. Revisa tu internet.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { codigo?: string; mensaje?: string } } | null)?.error;
    throw new ErrorApi(res.status, e?.codigo ?? "error", e?.mensaje ?? "Algo salió mal.", data);
  }
  return data as T;
}
