"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Receipt } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { ListaTransacciones } from "@/components/lista-transacciones";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { VistaTx } from "@/hooks/use-transaccion";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";
import { supabaseNavegador } from "@/lib/supabase/client";
import { fechaLarga, mxn } from "@/lib/utils";

interface Corte {
  fecha: string;
  resumen: { ventas: number; total_centavos: number; descuento_centavos: number; codi_centavos: number; efectivo_centavos: number; no_completadas: number };
  transacciones: VistaTx[];
}

/** Pagos de hoy, en vivo: cada escaneo del QR aparece aquí al momento (Supabase Realtime). */
export default function PagosDeHoy() {
  const qc = useQueryClient();
  const yo = useYo();
  const comercioId = yo.data?.comercio?.id;
  const q = useQuery({ queryKey: ["corte"], queryFn: () => api<Corte>("/api/c/corte"), refetchInterval: 15_000 });

  useEffect(() => {
    if (!comercioId) return;
    const sb = supabaseNavegador();
    const canal = sb
      .channel(`pagos:${comercioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transacciones", filter: `comercio_id=eq.${comercioId}` }, (m) => {
        void qc.invalidateQueries({ queryKey: ["corte"] });
        const n = m.new as { estado?: string } | undefined;
        if (m.eventType === "UPDATE" && n?.estado === "pagada") {
          toast.success("¡Pago recibido!");
          navigator.vibrate?.([80, 40, 80]);
        }
      })
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [comercioId, qc]);

  const confirmar = useMutation({
    mutationFn: (solicitudId: string) => api(`/api/c/solicitudes/${solicitudId}/efectivo`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Pago en efectivo registrado");
      void qc.invalidateQueries({ queryKey: ["corte"] });
    },
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo registrar."),
  });

  const porConfirmar = q.data?.transacciones.filter((t) => t.metodo === "efectivo" && t.estado === "pendiente" && t.solicitud_id) ?? [];

  return (
    <>
      <Encabezado titulo="Pagos de hoy" subtitulo={q.data ? fechaLarga(`${q.data.fecha}T12:00:00-06:00`) : undefined} />
      <Contenido>
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar los pagos." reintentar={() => q.refetch()} />
        ) : (
          <>
            {porConfirmar.map((t) => (
              <Card key={t.id} className="space-y-2 border-aviso/50 bg-aviso-fondo">
                <p className="font-bold text-aviso">Cobra en efectivo</p>
                <p className="text-3xl font-bold tabular-nums">{mxn(t.monto_final_centavos)}</p>
                <p className="text-sm">
                  {t.compra.tipo === "productos" ? t.compra.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(", ") : ""} · {t.convenio}
                </p>
                <Button variant="exito" cargando={confirmar.isPending && confirmar.variables === t.solicitud_id} onClick={() => confirmar.mutate(t.solicitud_id!)}>
                  <Banknote /> Recibí el efectivo
                </Button>
              </Card>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Dato titulo="Vendido" valor={mxn(q.data!.resumen.total_centavos)} />
              <Dato titulo="Pagos" valor={String(q.data!.resumen.ventas)} />
              <Dato titulo="CoDi" valor={mxn(q.data!.resumen.codi_centavos)} />
              <Dato titulo="Efectivo" valor={mxn(q.data!.resumen.efectivo_centavos)} />
              <Dato titulo="Descuentos dados" valor={mxn(q.data!.resumen.descuento_centavos)} className="col-span-2" />
            </div>
            {q.data!.transacciones.length ? (
              <ListaTransacciones txs={q.data!.transacciones} href={(t) => (t.solicitud_id ? `/c/cobro/${t.solicitud_id}` : "/c/corte")} />
            ) : (
              <Vacio titulo="Sin pagos hoy" icono={<Receipt />}>
                Cuando alguien escanee uno de tus QR, el pago aparecerá aquí al momento.
              </Vacio>
            )}
          </>
        )}
      </Contenido>
    </>
  );
}

function Dato({ titulo, valor, className }: { titulo: string; valor: string; className?: string }) {
  return (
    <Card className={className}>
      <p className="text-sm text-texto-suave">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
    </Card>
  );
}
