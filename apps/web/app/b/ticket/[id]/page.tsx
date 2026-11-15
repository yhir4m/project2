"use client";

import { use } from "react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado } from "@/components/estados";
import { Desglose, EstadoFinalNoPagado } from "@/components/pago/estado-cobro";
import { TicketVista } from "@/components/ticket";
import { useTransaccionEnVivo } from "@/hooks/use-transaccion";

export default function TicketBeneficiario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useTransaccionEnVivo(id);
  return (
    <>
      <Encabezado titulo="Ticket" atras="/b/historial" />
      <Contenido>
        {q.isLoading ? (
          <Cargando />
        ) : !q.data ? (
          <ErrorEstado mensaje="No encontramos este ticket." />
        ) : q.data.ticket ? (
          <TicketVista ticket={q.data.ticket} />
        ) : ["expirada", "cancelada", "fallida"].includes(q.data.estado) ? (
          <EstadoFinalNoPagado tx={q.data} />
        ) : (
          <Desglose tx={q.data} />
        )}
      </Contenido>
    </>
  );
}
