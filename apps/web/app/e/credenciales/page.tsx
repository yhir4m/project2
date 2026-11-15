"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ErrorApi } from "@/lib/api";
import { fechaLarga } from "@/lib/utils";

interface Cred {
  id: string;
  seudonimo: string;
  tipo_beneficiario: string;
  estado: "activa" | "revocada" | "vencida";
  vigente_hasta: string;
  motivo_revocacion: string | null;
}

export default function Credenciales() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [revocando, setRevocando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const q = useQuery({ queryKey: ["e-creds"], queryFn: () => api<{ credenciales: Cred[] }>("/api/e/credenciales").then((r) => r.credenciales) });
  const revocar = useMutation({
    mutationFn: (id: string) => api(`/api/e/credenciales/${id}/revocar`, { method: "POST", json: { motivo } }),
    onSuccess: () => {
      toast.success("Credencial revocada. Deja de funcionar de inmediato.");
      setRevocando(null);
      setMotivo("");
      void qc.invalidateQueries({ queryKey: ["e-creds"] });
    },
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo revocar."),
  });
  const lista = q.data?.filter((c) => c.seudonimo.includes(filtro.trim())) ?? [];

  return (
    <>
      <Encabezado titulo="Credenciales" subtitulo="Solo seudónimos: sin datos personales" />
      <Contenido>
        <Input placeholder="Buscar por seudónimo (ps_…)" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar credencial" />
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar las credenciales." reintentar={() => q.refetch()} />
        ) : !lista.length ? (
          <Vacio titulo="Sin credenciales" icono={<ShieldCheck />} />
        ) : (
          <ul className="space-y-2">
            {lista.map((c) => (
              <li key={c.id} className="rounded-xl border border-borde bg-superficie p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{c.seudonimo}</p>
                    <p className="text-sm text-texto-suave">Hasta {fechaLarga(c.vigente_hasta)}</p>
                  </div>
                  <Badge tono={c.estado === "activa" ? "exito" : c.estado === "revocada" ? "error" : "neutro"}>
                    {c.estado === "activa" ? "Activa" : c.estado === "revocada" ? "Revocada" : "Vencida"}
                  </Badge>
                </div>
                {c.estado === "activa" ? (
                  revocando === c.id ? (
                    <div className="mt-2 space-y-2">
                      <Input placeholder="Motivo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo de revocación" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secundario" size="md" onClick={() => setRevocando(null)}>Cancelar</Button>
                        <Button variant="peligro" size="md" disabled={motivo.trim().length < 3} cargando={revocar.isPending} onClick={() => revocar.mutate(c.id)}>Revocar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="fantasma" size="md" className="mt-1" onClick={() => setRevocando(c.id)}>Revocar</Button>
                  )
                ) : c.motivo_revocacion ? (
                  <p className="mt-1 text-sm text-texto-suave">Motivo: {c.motivo_revocacion}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Contenido>
    </>
  );
}
