import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PeyError } from "@cdv/pey";
import { ctx } from "./contexto";
import { ErrorHttp } from "./sesion";

export { ErrorHttp };

/** Envuelve un handler: errores tipados → JSON claro; cualquier otro → 500 sin filtrar detalles. */
export function ruta<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ErrorHttp) return error(e.status, e.codigo, e.message);
      if (e instanceof z.ZodError) {
        return NextResponse.json(
          { error: { codigo: "datos_invalidos", mensaje: "Revisa los datos enviados.", detalles: z.flattenError(e).fieldErrors } },
          { status: 400 },
        );
      }
      if (e instanceof PeyError) {
        console.error("[pey]", e.status, e.tipo, e.requestId, e.message);
        return error(502, "pey_error", "No pudimos comunicarnos con el sistema de pagos. Intenta de nuevo.");
      }
      console.error(e);
      return error(500, "error_interno", "Algo salió mal. Intenta de nuevo.");
    }
  };
}

export function error(status: number, codigo: string, mensaje: string) {
  return NextResponse.json({ error: { codigo, mensaje } }, { status });
}

export async function leerJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ErrorHttp(400, "json_invalido", "La solicitud no es válida.");
  }
  return schema.parse(body);
}

/** Rate limit de ventana fija; lanza 429 si se excede. */
export async function limitar(clave: string, limite: number, ventanaSeg: number) {
  const ok = await ctx().repo.rateLimit(clave, limite, ventanaSeg);
  if (!ok) throw new ErrorHttp(429, "demasiadas_solicitudes", "Hiciste muchos intentos. Espera un momento.");
}

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
