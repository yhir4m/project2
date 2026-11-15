"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Compra } from "@cdv/core";
import { api } from "@/lib/api";
import { supabaseNavegador } from "@/lib/supabase/client";
import type { VistaTx } from "./use-transaccion";

export interface VistaSolicitud {
  solicitud: {
    id: string;
    estado: "abierta" | "tomada" | "pagada" | "cancelada" | "expirada";
    compra: Compra;
    total_centavos: number;
    expira_en: string;
  };
  qr: string | null;
  transaccion: VistaTx | null;
}

const FINALES = new Set(["pagada", "cancelada", "expirada"]);

/**
 * Pantalla del comercio en tiempo real: Supabase Realtime sobre su solicitud y sobre la transacción
 * (RLS: solo el comercio dueño). Respaldo: consulta cada 3 s mientras siga viva.
 */
export function useSolicitudEnVivo(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["solicitud", id],
    queryFn: () => api<VistaSolicitud>(`/api/c/solicitudes/${id}`),
    refetchInterval: (s) => (s.state.data && FINALES.has(s.state.data.solicitud.estado) ? false : 3000),
    staleTime: 0,
  });
  const txId = q.data?.transaccion?.id;

  useEffect(() => {
    const sb = supabaseNavegador();
    const refrescar = () => void qc.invalidateQueries({ queryKey: ["solicitud", id] });
    let canal = sb
      .channel(`sol:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "solicitudes_cobro", filter: `id=eq.${id}` }, refrescar);
    if (txId) {
      canal = canal.on("postgres_changes", { event: "UPDATE", schema: "public", table: "transacciones", filter: `id=eq.${txId}` }, refrescar);
    }
    canal.subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [id, txId, qc]);

  return q;
}
