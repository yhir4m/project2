"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { ListaTransacciones } from "@/components/lista-transacciones";
import { Card } from "@/components/ui/card";
import type { VistaTx } from "@/hooks/use-transaccion";
import { api } from "@/lib/api";
import { fechaLarga, mxn } from "@/lib/utils";

interface Corte {
  fecha: string;
  resumen: { ventas: number; total_centavos: number; descuento_centavos: number; codi_centavos: number; efectivo_centavos: number; no_completadas: number };
  transacciones: VistaTx[];
}

export default function CorteDelDia() {
  const q = useQuery({ queryKey: ["corte"], queryFn: () => api<Corte>("/api/c/corte"), refetchInterval: 20_000 });
  return (
    <>
      <Encabezado titulo="Corte del día" subtitulo={q.data ? fechaLarga(`${q.data.fecha}T12:00:00-06:00`) : undefined} />
      <Contenido>
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar el corte." reintentar={() => q.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Dato titulo="Vendido" valor={mxn(q.data!.resumen.total_centavos)} />
              <Dato titulo="Ventas" valor={String(q.data!.resumen.ventas)} />
              <Dato titulo="CoDi" valor={mxn(q.data!.resumen.codi_centavos)} />
              <Dato titulo="Efectivo" valor={mxn(q.data!.resumen.efectivo_centavos)} />
              <Dato titulo="Descuentos dados" valor={mxn(q.data!.resumen.descuento_centavos)} className="col-span-2" />
            </div>
            {q.data!.transacciones.length ? (
              <ListaTransacciones txs={q.data!.transacciones} href={(t) => (t.solicitud_id ? `/c/cobro/${t.solicitud_id}` : "/c/corte")} />
            ) : (
              <Vacio titulo="Sin ventas hoy" icono={<Receipt />}>Aquí verás cada cobro con descuento.</Vacio>
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
