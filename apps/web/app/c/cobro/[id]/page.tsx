"use client";

import { motion } from "framer-motion";
import { Banknote, CheckCircle2, Clock, Plus, Smartphone, XCircle } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado } from "@/components/estados";
import { Desglose } from "@/components/pago/estado-cobro";
import { TicketVista } from "@/components/ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSolicitudEnVivo } from "@/hooks/use-solicitud";
import { api, ErrorApi } from "@/lib/api";
import { mxn } from "@/lib/utils";

/** Comercio: código de cobro en pantalla → el cliente lo escanea → pago en vivo → ticket. */
export default function CodigoDeCobro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useSolicitudEnVivo(id);
  const [ocupado, setOcupado] = useState(false);
  const s = q.data?.solicitud;
  const tx = q.data?.transaccion;

  useEffect(() => {
    if (s?.estado === "pagada") {
      toast.success("¡Pago recibido!");
      navigator.vibrate?.([80, 40, 80]);
    }
  }, [s?.estado]);

  async function accion(ruta: "cancelar" | "efectivo") {
    setOcupado(true);
    try {
      await api(`/api/c/solicitudes/${id}/${ruta}`, { method: "POST" });
      await q.refetch();
    } catch (e) {
      toast.error(e instanceof ErrorApi ? e.message : "No se pudo completar.");
    } finally {
      setOcupado(false);
    }
  }

  const titulo =
    !s ? "Cobro"
    : s.estado === "abierta" ? "Esperando al cliente"
    : s.estado === "tomada" ? (tx?.metodo === "efectivo" ? "Cobra en efectivo" : "El cliente está pagando")
    : s.estado === "pagada" ? "Pagado"
    : s.estado === "cancelada" ? "Cobro cancelado"
    : "El código expiró";

  return (
    <>
      <Encabezado titulo={titulo} atras="/c" />
      <Contenido>
        {q.isLoading ? (
          <Cargando />
        ) : q.isError || !s ? (
          <ErrorEstado mensaje="No encontramos este cobro." reintentar={() => q.refetch()} />
        ) : s.estado === "pagada" && tx?.ticket ? (
          <>
            <TicketVista ticket={tx.ticket} />
            <Button asChild size="xl">
              <Link href="/c">
                <Plus /> Nuevo cobro
              </Link>
            </Button>
          </>
        ) : s.estado === "cancelada" || s.estado === "expirada" ? (
          <>
            <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-error-fondo p-6 text-center text-error">
              {s.estado === "cancelada" ? <XCircle className="size-12" aria-hidden /> : <Clock className="size-12" aria-hidden />}
              <p className="text-xl font-bold">{titulo}</p>
              <p className="text-texto">No se hizo ningún cargo.</p>
            </div>
            <Button asChild size="xl">
              <Link href="/c">Nuevo cobro</Link>
            </Button>
          </>
        ) : s.estado === "abierta" && q.data!.qr ? (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 text-center">
              <p className="text-lg font-bold">Pide al cliente que escanee este código con la app</p>
              <div
                className="mx-auto w-full max-w-[21rem] rounded-2xl bg-white p-5 shadow-lg ring-4 ring-primario"
                role="img"
                aria-label="Código QR de cobro"
              >
                <QRCodeSVG value={q.data!.qr} level="M" marginSize={2} className="h-auto w-full" bgColor="#FFFFFF" fgColor="#1A252B" />
              </div>
              <p className="text-texto-suave">Total sin descuento</p>
              <p className="text-3xl font-bold tabular-nums">{mxn(s.total_centavos)}</p>
              <Expira en={s.expira_en} />
            </motion.div>
            <Button variant="fantasma" cargando={ocupado} onClick={() => accion("cancelar")}>
              Cancelar cobro
            </Button>
          </>
        ) : tx ? (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-exito/30 bg-exito-fondo p-4">
              <CheckCircle2 className="size-8 shrink-0 text-exito" aria-hidden />
              <div>
                <p className="font-bold text-exito">Descuento verificado</p>
                <p className="font-semibold">{tx.convenio}</p>
                <Badge className="mt-1">Sin datos personales del cliente</Badge>
              </div>
            </div>
            <Desglose tx={tx} />
            {tx.metodo === "efectivo" ? (
              <>
                <p className="text-center text-xl font-bold">
                  Cobra {mxn(tx.monto_final_centavos)} en efectivo
                </p>
                <Button variant="exito" size="xl" cargando={ocupado} onClick={() => accion("efectivo")}>
                  <Banknote /> Recibí el efectivo
                </Button>
              </>
            ) : (
              <motion.p
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="flex items-center justify-center gap-2 py-2 text-center text-lg font-bold"
              >
                <Smartphone className="size-6" aria-hidden /> Esperando que autorice en su banco…
              </motion.p>
            )}
            <Button variant="fantasma" cargando={ocupado} onClick={() => accion("cancelar")}>
              Cancelar cobro
            </Button>
          </>
        ) : (
          <Cargando texto="Actualizando…" />
        )}
      </Contenido>
    </>
  );
}

function Expira({ en }: { en: string }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((new Date(en).getTime() - ahora) / 1000));
  return (
    <p className="text-sm text-texto-suave">
      El código vence en{" "}
      <span className="font-semibold tabular-nums">
        {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
      </span>
    </p>
  );
}
