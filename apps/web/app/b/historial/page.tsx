"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { ListaTransacciones } from "@/components/lista-transacciones";
import { Card } from "@/components/ui/card";
import type { VistaTx } from "@/hooks/use-transaccion";
import { api } from "@/lib/api";
import { mxn } from "@/lib/utils";

export default function Historial() {
  const q = useQuery({
    queryKey: ["historial"],
    queryFn: () => api<{ transacciones: VistaTx[] }>("/api/b/transacciones").then((r) => r.transacciones),
  });
  const ahorro = q.data?.filter((t) => t.estado === "pagada").reduce((s, t) => s + t.descuento_centavos, 0) ?? 0;
  return (
    <>
      <Encabezado titulo="Historial" subtitulo="Tus compras con descuento" />
      <Contenido>
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar tu historial." reintentar={() => q.refetch()} />
        ) : q.data!.length === 0 ? (
          <Vacio titulo="Aún no tienes compras" icono={<Receipt />}>
            Cuando pagues con tu QR, aquí verás tus tickets.
          </Vacio>
        ) : (
          <>
            <Card className="bg-exito-fondo text-center">
              <p className="text-exito">Has ahorrado</p>
              <p className="text-3xl font-bold text-exito">{mxn(ahorro)}</p>
            </Card>
            <ListaTransacciones txs={q.data!} href={(t) => `/b/ticket/${t.id}`} />
          </>
        )}
      </Contenido>
    </>
  );
}
