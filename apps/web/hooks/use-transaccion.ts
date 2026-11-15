"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { supabaseNavegador } from "@/lib/supabase/client";
import type { Compra, Ticket } from "@cdv/core";

export interface VistaTx {
  id: string;
  solicitud_id: string | null;
  estado: "creando" | "pendiente" | "incierta" | "pagada" | "expirada" | "cancelada" | "fallida";
  metodo: "codi" | "efectivo";
  canal: "pn" | "qr" | null;
  comercio: string;
  convenio: string;
  con_descuento: boolean;
  compra: Compra;
  precio_original_centavos: number;
  descuento_centavos: number;
  monto_final_centavos: number;
  monto_cobrado_centavos: number;
  modo_prueba: boolean;
  expira_en: string | null;
  pagada_en: string | null;
  created_at: string;
  pey_id: string | null;
  ticket: Ticket | null;
  simulado: boolean;
}

const VIVOS = new Set(["creando", "pendiente", "incierta"]);

/**
 * Estado del pago en tiempo real: suscripción de Supabase Realtime a la fila de `transacciones`
 * (RLS limita a comercio y beneficiario). Ante cada cambio se vuelve a pedir la vista al servidor.
 * Respaldo: consulta cada 5 s mientras el cobro está vivo (el servidor concilia expiraciones con Pey).
 */
export function useTransaccionEnVivo(id: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const sb = supabaseNavegador();
    const canal = sb
      .channel(`tx:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transacciones", filter: `id=eq.${id}` }, () => {
        void qc.invalidateQueries({ queryKey: ["tx", id] });
      })
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [id, qc]);

  return useQuery({
    queryKey: ["tx", id],
    enabled: Boolean(id),
    queryFn: () => api<{ transaccion: VistaTx }>(`/api/transacciones/${id}`).then((r) => r.transaccion),
    refetchInterval: (q) => (q.state.data && !VIVOS.has(q.state.data.estado) ? false : 5000),
    staleTime: 0,
  });
}
