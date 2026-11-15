"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { api } from "@/lib/api";
import { fechaHora } from "@/lib/utils";

interface Noti {
  id: string;
  titulo: string;
  cuerpo: string | null;
  leida: boolean;
  created_at: string;
  datos: { transaccion_id?: string };
}

export default function Notificaciones() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notificaciones-lista"],
    queryFn: () => api<{ notificaciones: Noti[] }>("/api/notificaciones").then((r) => r.notificaciones),
  });
  useEffect(() => {
    if (q.data?.some((n) => !n.leida)) {
      void api("/api/notificaciones", { method: "POST", json: {} }).then(() => qc.invalidateQueries({ queryKey: ["notificaciones"] }));
    }
  }, [q.data, qc]);

  return (
    <>
      <Encabezado titulo="Notificaciones" atras="/b" />
      <Contenido>
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar tus notificaciones." reintentar={() => q.refetch()} />
        ) : q.data!.length === 0 ? (
          <Vacio titulo="Sin notificaciones" icono={<Bell />} />
        ) : (
          <ul className="space-y-2">
            {q.data!.map((n) => {
              const contenido = (
                <div className={`rounded-xl border p-4 ${n.leida ? "border-borde bg-superficie" : "border-primario/40 bg-primario/5"}`}>
                  <p className="font-bold">{n.titulo}</p>
                  {n.cuerpo ? <p className="text-texto-suave">{n.cuerpo}</p> : null}
                  <p className="mt-1 text-sm text-texto-suave">{fechaHora(n.created_at)}</p>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.datos.transaccion_id ? <Link href={`/b/ticket/${n.datos.transaccion_id}`}>{contenido}</Link> : contenido}
                </li>
              );
            })}
          </ul>
        )}
      </Contenido>
    </>
  );
}
