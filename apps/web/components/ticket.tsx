import { CheckCircle2, FlaskConical } from "lucide-react";
import type { Ticket } from "@cdv/core";
import { Card } from "@/components/ui/card";

/** Ticket con desglose. Lo ven ambas partes al confirmarse el pago. */
export function TicketVista({ ticket }: { ticket: Ticket }) {
  return (
    <Card className="overflow-hidden p-0" aria-label="Ticket de compra">
      <div className="flex flex-col items-center gap-2 bg-exito-fondo px-4 py-6 text-exito">
        <CheckCircle2 className="size-14" aria-hidden />
        <p className="text-xl font-bold">Pago confirmado</p>
        <p className="text-3xl font-bold text-texto">{ticket.monto_pagado}</p>
      </div>
      <dl className="divide-y divide-dashed divide-borde px-4">
        <Fila k="Comercio" v={ticket.comercio} />
        <Fila k="Convenio" v={ticket.convenio} />
        <Fila k="Precio original" v={ticket.precio_original} />
        <Fila k="Descuento" v={`− ${ticket.descuento}`} destacado />
        <Fila k="Total pagado" v={ticket.monto_pagado} fuerte />
        <Fila k="Método" v={ticket.metodo === "codi" ? "CoDi" : "Efectivo"} />
        <Fila k="Fecha" v={ticket.fecha} />
        <Fila k="Folio" v={ticket.folio} />
        {ticket.pey_id ? <Fila k="ID de pago" v={ticket.pey_id} mono /> : null}
      </dl>
      {ticket.modo_prueba ? (
        <p className="m-4 flex items-start gap-2 rounded-lg bg-aviso-fondo p-3 text-sm font-semibold text-aviso">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          Modo prueba: por CoDi se cobró {ticket.monto_cobrado_real ?? "un monto simbólico"} en lugar del total.
        </p>
      ) : null}
    </Card>
  );
}

function Fila({ k, v, fuerte, destacado, mono }: { k: string; v: string; fuerte?: boolean; destacado?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-texto-suave">{k}</dt>
      <dd
        className={[
          "text-right",
          fuerte ? "text-lg font-bold" : "font-semibold",
          destacado ? "text-exito" : "",
          mono ? "break-all font-mono text-sm" : "",
        ].join(" ")}
      >
        {v}
      </dd>
    </div>
  );
}
