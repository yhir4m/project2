"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { use } from "react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { useYo } from "@/hooks/use-yo";
import { api } from "@/lib/api";
import { mxn } from "@/lib/utils";
import type { QrFijo } from "../../page";

/** QR fijo en grande, para mostrarlo en pantalla o imprimirlo y pegarlo en el mostrador. */
export default function VerQr({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const yo = useYo();
  const q = useQuery({ queryKey: ["qrs"], queryFn: () => api<{ qrs: QrFijo[] }>("/api/c/qrs").then((r) => r.qrs) });
  const x = q.data?.find((y) => y.id === id);

  return (
    <>
      <div className="print:hidden">
        <Encabezado titulo="QR de cobro" atras="/c" />
      </div>
      <Contenido>
        {q.isLoading ? (
          <Cargando />
        ) : !x ? (
          <ErrorEstado mensaje="No encontramos este QR." />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-lg font-semibold text-acento">{yo.data?.comercio?.nombre}</p>
            <div className="w-full max-w-[22rem] rounded-2xl bg-white p-5 shadow-lg ring-4 ring-primario print:shadow-none">
              <QRCodeSVG value={x.url} level="M" marginSize={2} className="h-auto w-full" fgColor="#1A252B" />
            </div>
            <p className="text-2xl font-bold">{x.nombre}</p>
            <p className="text-4xl font-bold tabular-nums">{mxn(x.precio_centavos)}</p>
            <p className="text-texto-suave">Escanea con la cámara de tu celular para pagar. Estudiantes e INAPAM: tu descuento se aplica solo.</p>
            {!x.activo ? <p className="font-bold text-error">Este QR está desactivado.</p> : null}
            <Button className="print:hidden" variant="secundario" onClick={() => window.print()}>
              <Printer /> Imprimir
            </Button>
            <p className="break-all text-xs text-texto-suave print:hidden">{x.url}</p>
          </div>
        )}
      </Contenido>
    </>
  );
}
