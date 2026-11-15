"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";

export interface Yo {
  id: string;
  rol: "beneficiario" | "comercio" | "emisor";
  nombre: string | null;
  email: string | null;
  celular: string | null;
  tiene_celular: boolean;
  letra_grande: boolean;
  consentimiento: boolean;
  comercio: { id: string; nombre: string } | null;
  emisor: { id: string; nombre: string; nombre_corto: string; tipos_beneficiario: string[] } | null;
  app: { modo_prueba: boolean; monto_prueba: number; pey_simulado: boolean; demo: boolean };
}

export function useYo() {
  const q = useQuery({
    queryKey: ["yo"],
    queryFn: () => api<{ usuario: Yo | null }>("/api/yo").then((r) => r.usuario),
    staleTime: 60_000,
  });
  // Modo letra grande: se aplica a toda la app.
  useEffect(() => {
    const grande = q.data?.letra_grande;
    if (grande === undefined) return;
    document.documentElement.dataset.letra = grande ? "grande" : "normal";
    try {
      localStorage.setItem("cdv_letra", grande ? "grande" : "normal");
    } catch {}
  }, [q.data?.letra_grande]);
  return q;
}

export function useActualizarYo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cambios: Partial<{ nombre: string; celular: string | null; letra_grande: boolean; consentimiento: true }>) =>
      api<{ usuario: Yo }>("/api/yo", { method: "PATCH", json: cambios }).then((r) => r.usuario),
    onSuccess: (u) => qc.setQueryData(["yo"], u),
  });
}
