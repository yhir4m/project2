"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ErrorApi } from "@/lib/api";
import { fechaHora } from "@/lib/utils";

interface Pendiente {
  id: string;
  nombre_declarado: string | null;
  tipo_beneficiario: string;
  confianza: number | null;
  motivos: string[];
  tiene_documento: boolean;
  created_at: string;
}

const MOTIVOS: Record<string, string> = {
  confianza_baja: "La IA no está segura",
  nombre_no_coincide: "El nombre no coincide",
  institucion_no_coincide: "La institución no coincide",
  sin_fechas: "No se ven fechas",
  fecha_futura: "Fecha en el futuro",
  documento_ilegible: "Documento ilegible",
  ia_no_configurada: "Sin revisión automática",
  ia_fallo: "La revisión automática falló",
};

export default function Revision() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["e-revision"], queryFn: () => api<{ cola: Pendiente[] }>("/api/e/revision").then((r) => r.cola), refetchInterval: 15_000 });
  const resolver = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "aprobar" | "rechazar" }) =>
      api(`/api/e/revision/${id}`, { method: "POST", json: { decision } }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "aprobar" ? "Aprobada. Se emitió la credencial." : "Rechazada.");
      void qc.invalidateQueries({ queryKey: ["e-revision"] });
    },
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo resolver."),
  });

  return (
    <>
      <Encabezado titulo="Cola de revisión" subtitulo="Documentos que la IA no pudo aprobar" />
      <Contenido>
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar la cola." reintentar={() => q.refetch()} />
        ) : !q.data!.length ? (
          <Vacio titulo="Todo al día" icono={<FileCheck2 />}>No hay documentos pendientes.</Vacio>
        ) : (
          q.data!.map((v) => (
            <Card key={v.id} className="space-y-3">
              <div>
                <p className="text-lg font-bold">{v.nombre_declarado ?? "Sin nombre"}</p>
                <p className="text-sm text-texto-suave">{fechaHora(v.created_at)}{v.confianza !== null ? ` · confianza ${Math.round(v.confianza * 100)}%` : ""}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {v.motivos.map((m) => <Badge key={m} tono="aviso">{MOTIVOS[m] ?? m}</Badge>)}
                </div>
              </div>
              {v.tiene_documento ? (
                // eslint-disable-next-line @next/next/no-img-element -- documento privado servido por la API, no optimizable
                <img src={`/api/e/revision/${v.id}/documento`} alt={`Documento de ${v.nombre_declarado ?? "la persona"}`} className="max-h-96 w-full rounded-lg border border-borde bg-fondo object-contain" />
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="peligro" cargando={resolver.isPending && resolver.variables?.id === v.id && resolver.variables.decision === "rechazar"} onClick={() => resolver.mutate({ id: v.id, decision: "rechazar" })}>Rechazar</Button>
                <Button variant="exito" cargando={resolver.isPending && resolver.variables?.id === v.id && resolver.variables.decision === "aprobar"} onClick={() => resolver.mutate({ id: v.id, decision: "aprobar" })}>Aprobar</Button>
              </div>
              <p className="text-xs text-texto-suave">Al resolver, el documento y el nombre se borran. Solo queda el resultado.</p>
            </Card>
          ))
        )}
      </Contenido>
    </>
  );
}
