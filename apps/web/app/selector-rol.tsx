"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, ChevronRight, GraduationCap, HeartHandshake, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Cargando, ErrorEstado } from "@/components/estados";
import { api, ErrorApi } from "@/lib/api";

interface UsuarioDemo {
  id: string;
  rol: "beneficiario" | "comercio" | "emisor";
  nombre: string | null;
  detalle: string | null;
}

const SECCIONES = [
  { rol: "beneficiario", titulo: "Soy beneficiario", texto: "Muestra tu código y paga con descuento.", Icono: GraduationCap },
  { rol: "comercio", titulo: "Soy comercio", texto: "Escanea, aplica el descuento y cobra con CoDi.", Icono: Store },
  { rol: "emisor", titulo: "Soy institución", texto: "Convenios, revisiones, credenciales y reportes.", Icono: Building2 },
] as const;

export function SelectorRol({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [entrando, setEntrando] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["demo-usuarios"],
    queryFn: () => api<{ usuarios: UsuarioDemo[] }>("/api/demo/entrar").then((r) => r.usuarios),
    enabled: demo,
  });

  async function entrar(id: string) {
    setEntrando(id);
    try {
      const r = await api<{ destino: string }>("/api/demo/entrar", { method: "POST", json: { usuarioId: id } });
      router.replace(r.destino);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ErrorApi ? e.message : "No pudimos entrar.");
      setEntrando(null);
    }
  }

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-md bg-fondo px-4 sm:shadow-2xl">
      <header className="pb-4 pt-10">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primario text-primario-texto">
          <HeartHandshake className="size-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold leading-tight">Descuento Verificado</h1>
        <p className="mt-2 text-lg text-texto-suave">
          Verifica tu descuento una vez. Úsalo con un solo escaneo y paga con CoDi.
        </p>
      </header>

      {!demo ? (
        <ErrorEstado mensaje="El acceso de demostración está desactivado." />
      ) : q.isLoading ? (
        <Cargando />
      ) : q.isError ? (
        <ErrorEstado mensaje="No pudimos cargar la demo." reintentar={() => q.refetch()} />
      ) : (
        <div className="space-y-6 pb-10">
          <p className="rounded-xl bg-aviso-fondo px-4 py-3 text-base font-semibold text-aviso">
            Demo: elige un rol y una persona para entrar.
          </p>
          {SECCIONES.map(({ rol, titulo, texto, Icono }, i) => (
            <motion.section
              key={rol}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              aria-labelledby={`rol-${rol}`}
            >
              <div className="mb-2 flex items-center gap-3">
                <Icono className="size-7 text-primario" aria-hidden />
                <div>
                  <h2 id={`rol-${rol}`} className="text-xl font-bold">{titulo}</h2>
                  <p className="text-sm text-texto-suave">{texto}</p>
                </div>
              </div>
              <ul className="overflow-hidden rounded-xl border border-borde bg-superficie">
                {q.data!.filter((u) => u.rol === rol).map((u) => (
                  <li key={u.id} className="border-b border-borde last:border-0">
                    <button
                      onClick={() => entrar(u.id)}
                      disabled={entrando !== null}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-fondo disabled:opacity-60"
                    >
                      <span className="flex-1">
                        <span className="block text-lg font-semibold">{u.nombre}</span>
                        {u.detalle ? <span className="block text-sm text-texto-suave">{u.detalle}</span> : null}
                      </span>
                      {entrando === u.id ? (
                        <span className="size-6 animate-spin rounded-full border-2 border-primario border-r-transparent" />
                      ) : (
                        <ChevronRight className="size-6 text-texto-suave" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
          <a href="/entrar" className="flex min-h-14 items-center justify-center rounded-xl border-2 border-primario font-semibold text-primario">
            Entrar con mi correo
          </a>
          <p className="text-center text-sm text-texto-suave">
            Al continuar aceptas el <a className="font-semibold text-primario underline" href="/privacidad">aviso de privacidad</a>.
          </p>
        </div>
      )}
    </main>
  );
}
