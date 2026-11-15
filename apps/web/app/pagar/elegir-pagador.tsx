"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScanLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/estados";
import { api, ErrorApi } from "@/lib/api";

interface UsuarioDemo {
  id: string;
  rol: string;
  nombre: string | null;
}

export function ElegirPagador({ destino, demo }: { destino: string; demo: boolean }) {
  const [entrando, setEntrando] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["demo-usuarios"],
    queryFn: () => api<{ usuarios: UsuarioDemo[] }>("/api/demo/entrar").then((r) => r.usuarios.filter((u) => u.rol === "beneficiario")),
    enabled: demo,
  });

  async function entrar(id: string) {
    setEntrando(id);
    try {
      await api("/api/demo/entrar", { method: "POST", json: { usuarioId: id } });
      window.location.replace(destino);
    } catch (e) {
      toast.error(e instanceof ErrorApi ? e.message : "No pudimos entrar.");
      setEntrando(null);
    }
  }

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-md space-y-5 bg-fondo px-4 py-10 sm:shadow-2xl">
      <div className="grid size-14 place-items-center rounded-2xl bg-primario text-primario-texto">
        <ScanLine className="size-8" aria-hidden />
      </div>
      <h1 className="text-3xl font-bold">Pagar con descuento</h1>
      <p className="text-lg text-texto-suave">Elige con qué cuenta vas a pagar. Si eres estudiante o INAPAM, tu descuento se aplica solo.</p>
      {demo ? (
        q.isLoading ? (
          <Cargando />
        ) : (
          <ul className="overflow-hidden rounded-xl border border-borde bg-superficie">
            {q.data?.map((u) => (
              <li key={u.id} className="border-b border-borde last:border-0">
                <button
                  onClick={() => entrar(u.id)}
                  disabled={entrando !== null}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-superficie-2 disabled:opacity-60"
                >
                  <span className="flex-1 text-lg font-semibold">{u.nombre}</span>
                  {entrando === u.id ? (
                    <span className="size-6 animate-spin rounded-full border-2 border-acento border-r-transparent" />
                  ) : (
                    <ChevronRight className="size-6 text-texto-suave" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <a
        href={`/entrar?next=${encodeURIComponent(destino)}`}
        className="flex min-h-14 items-center justify-center rounded-xl border-2 border-acento font-semibold text-acento"
      >
        Entrar con mi correo
      </a>
    </main>
  );
}
