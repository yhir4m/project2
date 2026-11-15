"use client";

import { AlertCircle, Clock, XCircle } from "lucide-react";
import type { VistaTx } from "@/hooks/use-transaccion";
import { mxn } from "@/lib/utils";

export const TEXTO_ESTADO: Record<VistaTx["estado"], string> = {
  creando: "Creando cobro…",
  pendiente: "Esperando autorización",
  incierta: "Confirmando con el banco…",
  pagada: "Pagado",
  expirada: "El cobro expiró",
  cancelada: "Cobro cancelado",
  fallida: "El cobro no se pudo crear",
};

export function Desglose({ tx }: { tx: VistaTx }) {
  return (
    <dl className="space-y-1 rounded-xl bg-fondo p-4">
      <div className="flex justify-between"><dt className="text-texto-suave">Precio</dt><dd className="font-semibold">{mxn(tx.precio_original_centavos)}</dd></div>
      <div className="flex justify-between text-exito"><dt>Descuento</dt><dd className="font-semibold">− {mxn(tx.descuento_centavos)}</dd></div>
      <div className="flex justify-between border-t border-borde pt-2 text-lg"><dt className="font-bold">Total</dt><dd className="font-bold">{mxn(tx.monto_final_centavos)}</dd></div>
      {tx.modo_prueba ? (
        <p className="pt-1 text-sm font-semibold text-aviso">Modo prueba: por CoDi se cobran {mxn(tx.monto_cobrado_centavos)}.</p>
      ) : null}
    </dl>
  );
}

export function EstadoFinalNoPagado({ tx }: { tx: VistaTx }) {
  const Icono = tx.estado === "expirada" ? Clock : tx.estado === "cancelada" ? XCircle : AlertCircle;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-error-fondo p-6 text-center text-error">
      <Icono className="size-12" aria-hidden />
      <p className="text-xl font-bold">{TEXTO_ESTADO[tx.estado]}</p>
      <p className="text-texto">No se hizo ningún cargo. Puedes intentarlo de nuevo.</p>
    </div>
  );
}
