"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, HeartHandshake, ShieldCheck, Store, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ErrorApi } from "@/lib/api";

interface UsuarioLogin {
  id: string;
  rol: "beneficiario" | "comercio" | "emisor";
  nombre: string | null;
  detalle: string | null;
}

const PERSONA_DEFAULT: UsuarioLogin = {
  id: "b0000000-0000-4000-8000-000000000001",
  rol: "beneficiario",
  nombre: "Ana",
  detalle: "Estudiante UTTAB · Beneficiario",
};

const NEGOCIO_DEFAULT: UsuarioLogin = {
  id: "d0000000-0000-4000-8000-000000000001",
  rol: "comercio",
  nombre: "Comercio Afiliado",
  detalle: "Terminal Punto de Venta CoDi®",
};

export function SelectorRol({ demo = true }: { demo?: boolean }) {
  const router = useRouter();
  const [entrandoId, setEntrandoId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["demo-usuarios"],
    queryFn: () => api<{ usuarios: UsuarioLogin[] }>("/api/demo/entrar").then((r) => r.usuarios),
    enabled: demo,
  });

  const persona = q.data?.find((u) => u.rol === "beneficiario") ?? PERSONA_DEFAULT;
  const negocio = q.data?.find((u) => u.rol === "comercio") ?? NEGOCIO_DEFAULT;

  async function entrar(id: string, nombre: string) {
    setEntrandoId(id);
    try {
      const r = await api<{ destino: string }>("/api/demo/entrar", {
        method: "POST",
        json: { usuarioId: id },
      });
      toast.success(`Accediendo como ${nombre}`);
      router.replace(r.destino);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ErrorApi ? e.message : "No se pudo iniciar sesión.");
      setEntrandoId(null);
    }
  }

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-md bg-fondo px-4 py-8 sm:shadow-2xl flex flex-col justify-between">
      <div>
        {/* Encabezado */}
        <header className="pt-4 pb-6 text-center">
          <div className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-primario text-primario-texto shadow-sm">
            <HeartHandshake className="size-9" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-texto">Descuento Verificado</h1>
          <p className="mt-2 text-base text-texto-suave">
            Verifica tu descuento una vez y úsalo con un solo escaneo. Pagos seguros con CoDi®.
          </p>
        </header>

        {/* Sección de Selección de Acceso */}
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-texto-suave px-1">
            Selecciona tu perfil de acceso
          </p>

          {/* Opción 1: La Persona (Beneficiario) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => entrar(persona.id, persona.nombre ?? "Persona")}
              disabled={entrandoId !== null}
              className="group relative flex w-full flex-col rounded-2xl border-2 border-borde bg-superficie p-5 text-left transition hover:border-acento hover:shadow-md active:bg-superficie-2 disabled:opacity-60"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-xl bg-superficie-2 text-acento border border-borde group-hover:bg-primario group-hover:text-primario-texto transition">
                    <User className="size-6" aria-hidden />
                  </div>
                  <div>
                    <span className="inline-block rounded-md bg-fondo px-2 py-0.5 text-xs font-bold text-acento border border-borde">
                      Persona
                    </span>
                    <h2 className="text-xl font-bold text-texto mt-0.5">
                      {persona.nombre ?? "Persona"}
                    </h2>
                  </div>
                </div>

                {entrandoId === persona.id ? (
                  <span className="size-6 animate-spin rounded-full border-2 border-acento border-r-transparent" />
                ) : (
                  <div className="grid size-8 place-items-center rounded-full bg-superficie-2 group-hover:bg-primario group-hover:text-primario-texto transition">
                    <ChevronRight className="size-5 text-texto-suave group-hover:text-primario-texto" aria-hidden />
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-texto-suave">
                {persona.detalle ?? "Beneficiario con credencial activa"}
              </p>

              <div className="mt-3 flex items-center gap-2 border-t border-borde pt-3 text-xs font-semibold text-acento">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                <span>Genera tu QR dinámico y paga con descuento</span>
              </div>
            </button>
          </motion.div>

          {/* Opción 2: El Negocio (Comercio) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.08 }}
          >
            <button
              type="button"
              onClick={() => entrar(negocio.id, negocio.nombre ?? "Negocio")}
              disabled={entrandoId !== null}
              className="group relative flex w-full flex-col rounded-2xl border-2 border-borde bg-superficie p-5 text-left transition hover:border-acento hover:shadow-md active:bg-superficie-2 disabled:opacity-60"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-xl bg-superficie-2 text-acento border border-borde group-hover:bg-primario group-hover:text-primario-texto transition">
                    <Store className="size-6" aria-hidden />
                  </div>
                  <div>
                    <span className="inline-block rounded-md bg-fondo px-2 py-0.5 text-xs font-bold text-acento border border-borde">
                      Negocio
                    </span>
                    <h2 className="text-xl font-bold text-texto mt-0.5">
                      {negocio.nombre ?? "Negocio Afiliado"}
                    </h2>
                  </div>
                </div>

                {entrandoId === negocio.id ? (
                  <span className="size-6 animate-spin rounded-full border-2 border-acento border-r-transparent" />
                ) : (
                  <div className="grid size-8 place-items-center rounded-full bg-superficie-2 group-hover:bg-primario group-hover:text-primario-texto transition">
                    <ChevronRight className="size-5 text-texto-suave group-hover:text-primario-texto" aria-hidden />
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-texto-suave">
                {negocio.detalle ?? "Punto de venta y cobros CoDi®"}
              </p>

              <div className="mt-3 flex items-center gap-2 border-t border-borde pt-3 text-xs font-semibold text-acento">
                <ArrowRight className="size-4 shrink-0" aria-hidden />
                <span>Escanea códigos, aplica convenios y cobra con CoDi</span>
              </div>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Pie de pantalla */}
      <footer className="mt-8 text-center pb-2">
        <p className="text-xs text-texto-suave">
          Al ingresar aceptas el{" "}
          <Link href="/privacidad" className="font-semibold text-acento underline">
            aviso de privacidad
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
