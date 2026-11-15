"use client";

import { motion } from "framer-motion";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado } from "@/components/estados";
import { Desglose, EstadoFinalNoPagado, TEXTO_ESTADO } from "@/components/pago/estado-cobro";
import { SimularPago } from "@/components/pago/simular-pago";
import { TicketVista } from "@/components/ticket";
import { Button } from "@/components/ui/button";
import { useTransaccionEnVivo } from "@/hooks/use-transaccion";
import { api } from "@/lib/api";

/** Esperando pago (tiempo real) → ticket. */
export default function CobroComercio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useTransaccionEnVivo(id);
  const tx = q.data;

  useEffect(() => {
    if (tx?.estado === "pagada") {
      toast.success("¡Pago recibido!");
      navigator.vibrate?.([80, 40, 80]);
    }
  }, [tx?.estado]);

  return (
    <>
      <Encabezado titulo={tx ? TEXTO_ESTADO[tx.estado] : "Cobro"} atras="/c" />
      <Contenido>
        {q.isLoading ? (
          <Cargando />
        ) : !tx ? (
          <ErrorEstado mensaje="No encontramos este cobro." reintentar={() => q.refetch()} />
        ) : tx.estado === "pagada" && tx.ticket ? (
          <>
            <TicketVista ticket={tx.ticket} />
            <Button asChild size="xl">
              <Link href="/c"><ScanLine /> Siguiente cliente</Link>
            </Button>
          </>
        ) : ["expirada", "cancelada", "fallida"].includes(tx.estado) ? (
          <>
            <EstadoFinalNoPagado tx={tx} />
            <Button asChild size="xl"><Link href="/c">Volver a escanear</Link></Button>
          </>
        ) : (
          <>
            {tx.canal === "qr" && tx.qr_cobro ? (
              <div className="space-y-2 text-center">
                <p className="text-lg font-bold">Pide al cliente que escanee este código CoDi con su app bancaria</p>
                <div className="mx-auto w-full max-w-[20rem] rounded-2xl bg-white p-4 shadow-lg">
                  <QRCodeSVG value={tx.qr_cobro} level="M" className="h-auto w-full" />
                </div>
              </div>
            ) : (
              <motion.p animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8 }} className="py-4 text-center text-xl font-bold">
                Cobro enviado. Esperando que el cliente lo autorice en su banco…
              </motion.p>
            )}
            <Desglose tx={tx} />
            <Expira en={tx.expira_en} />
            {tx.simulado && tx.metodo === "codi" ? <SimularPago transaccionId={tx.id} texto="Simular pago del cliente" /> : null}
            <Button
              variant="fantasma"
              onClick={async () => {
                await api(`/api/transacciones/${tx.id}/cancelar`, { method: "POST" });
                void q.refetch();
              }}
            >
              Cancelar cobro
            </Button>
          </>
        )}
      </Contenido>
    </>
  );
}

function Expira({ en }: { en: string | null }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!en) return null;
  const s = Math.max(0, Math.round((new Date(en).getTime() - ahora) / 1000));
  return (
    <p className="text-center text-texto-suave" aria-live="off">
      El cobro vence en <span className="font-semibold tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>
    </p>
  );
}
