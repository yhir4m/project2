"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CredencialVista {
  id: string;
  estado: "activa" | "revocada" | "vencida";
  emisor: string;
  emisor_corto: string;
  tipo_beneficiario: string;
  vigente_hasta: string;
  dispositivo_ligado: boolean;
  convenios: { id: string; nombre: string; regla: string; comercios: { id: string; nombre: string; direccion: string | null }[] }[];
}

export function useCredenciales() {
  return useQuery({
    queryKey: ["credenciales"],
    queryFn: () =>
      api<{ credenciales: CredencialVista[]; verificaciones_en_curso: { id: string; estado: string }[] }>("/api/b/credenciales"),
  });
}
