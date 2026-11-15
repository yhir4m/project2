"use client";

import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import Link from "next/link";
import { use, useEffect } from "react";
import { toast } from "sonner";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado } from "@/components/estados";
import { Desglose, EstadoFinalNoPagado, TEXTO_ESTADO } from "@/components/pago/estado-cobro";
import { SimularPago } from "@/components/pago/simular-pago";
import { TicketVista } from "@/components/ticket";
import { Button } from "@/components/ui/button";
import { useTransaccionEnVivo } from "@/hooks/use-transaccion";

/** Pago pendiente del beneficiario: autoriza en su app bancaria; la pantalla se actualiza sola. */
export default function PagoPendiente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useTransaccionEnVivo(id);
  const tx = q.data;

  useEffect(() => {
    if (tx?.estado === "pagada") {
      toast.success(`Pagaste ${tx.ticket?.monto_pagado} y ahorraste ${tx.ticket?.descuento}`);
      navigator.vibrate?.(120);
    }
  }, [tx?.estado, tx?.ticket?.monto_pagado, tx?.ticket?.descuento]);

  return (
    <>
      <Encabezado titulo={tx ? TEXTO_ESTADO[tx.estado] : "Tu pago"} subtitulo={tx?.comercio} atras="/b" />
      <Contenido>
        {q.isLoading ? (
          <Cargando />
        ) : q.isError || !tx ? (
          <ErrorEstado mensaje="No encontramos este pago." reintentar={() => q.refetch()} />
        ) : tx.estado === "pagada" && tx.ticket ? (
          <>
            <TicketVista ticket={tx.ticket} />
            <Button asChild variant="secundario">
              <Link href="/b/historial">Ver mi historial</Link>
            </Button>
          </>
        ) : ["expirada", "cancelada", "fallida"].includes(tx.estado) ? (
          <EstadoFinalNoPagado tx={tx} />
        ) : (
          <>
            <motion.div
              className="flex flex-col items-center gap-3 py-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="grid size-20 place-items-center rounded-full bg-primario/10 text-primario"
              >
                <Smartphone className="size-10" aria-hidden />
              </motion.div>
              <p className="text-xl font-bold">
                {tx.canal === "pn" ? "Abre tu app bancaria y autoriza el cobro CoDi" : "Escanea el código de cobro en la pantalla del negocio"}
              </p>
              <p className="text-texto-suave">Esta pantalla se actualizará sola cuando se confirme el pago.</p>
            </motion.div>
            <Desglose tx={tx} />
            {tx.simulado && tx.metodo === "codi" ? <SimularPago transaccionId={tx.id} /> : null}
          </>
        )}
      </Contenido>
    </>
  );
}
