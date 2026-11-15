"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Delete, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Compra } from "@cdv/core";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";
import { mxn } from "@/lib/utils";

/**
 * Comercio · Cobrar: captura el monto o los productos y genera el código de cobro.
 * El cliente lo escanea desde su app; su descuento se aplica en el servidor.
 */
export default function Cobrar() {
  const router = useRouter();
  const yo = useYo();
  const [modo, setModo] = useState<"monto" | "productos">("monto");
  const [centavos, setCentavos] = useState(0);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const productos = useQuery({
    queryKey: ["productos"],
    queryFn: () =>
      api<{ productos: { sku: string; nombre: string; precio_centavos: number }[] }>("/api/c/productos").then((r) => r.productos),
  });

  const compra: Compra | null =
    modo === "monto"
      ? centavos > 0
        ? { tipo: "monto", monto_centavos: centavos }
        : null
      : Object.keys(carrito).length && productos.data
        ? {
            tipo: "productos",
            items: Object.entries(carrito).map(([sku, cantidad]) => {
              const p = productos.data!.find((x) => x.sku === sku)!;
              return { sku, nombre: p.nombre, precio_centavos: p.precio_centavos, cantidad };
            }),
          }
        : null;
  const total =
    compra?.tipo === "monto"
      ? compra.monto_centavos
      : compra?.tipo === "productos"
        ? compra.items.reduce((s, i) => s + i.precio_centavos * i.cantidad, 0)
        : 0;

  const generar = useMutation({
    mutationFn: () => api<{ id: string }>("/api/c/solicitudes", { method: "POST", json: { compra } }),
    onSuccess: (r) => router.push(`/c/cobro/${r.id}`),
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo generar el cobro."),
  });

  return (
    <>
      <Encabezado titulo={yo.data?.comercio?.nombre ?? "Cobrar"} subtitulo="Nuevo cobro con descuento" accion={<BotonSalir />} />
      <Contenido>
        <div role="tablist" className="grid grid-cols-2 rounded-xl bg-superficie-2 p-1">
          {(["monto", "productos"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={`min-h-12 rounded-lg font-semibold ${modo === m ? "bg-superficie shadow" : "text-texto-suave"}`}
            >
              {m === "monto" ? "Monto" : "Productos"}
            </button>
          ))}
        </div>

        {modo === "monto" ? (
          <Teclado centavos={centavos} onChange={setCentavos} />
        ) : productos.isLoading ? (
          <p className="text-center text-texto-suave">Cargando productos…</p>
        ) : !productos.data?.length ? (
          <p className="text-center text-texto-suave">Este negocio no tiene productos registrados. Usa “Monto”.</p>
        ) : (
          <ul className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-superficie">
            {productos.data.map((p) => {
              const n = carrito[p.sku] ?? 0;
              return (
                <li key={p.sku} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-sm text-texto-suave">{mxn(p.precio_centavos)}</p>
                  </div>
                  <Button
                    variant="secundario"
                    size="icono"
                    ancho="auto"
                    aria-label={`Quitar ${p.nombre}`}
                    disabled={!n}
                    onClick={() =>
                      setCarrito(({ [p.sku]: actual = 0, ...resto }) => (actual > 1 ? { ...resto, [p.sku]: actual - 1 } : resto))
                    }
                  >
                    −
                  </Button>
                  <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">
                    {n}
                  </span>
                  <Button
                    variant="secundario"
                    size="icono"
                    ancho="auto"
                    aria-label={`Agregar ${p.nombre}`}
                    onClick={() => setCarrito((c) => ({ ...c, [p.sku]: (c[p.sku] ?? 0) + 1 }))}
                  >
                    +
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-baseline justify-between rounded-xl bg-superficie px-4 py-3 shadow-sm">
          <span className="text-texto-suave">Total sin descuento</span>
          <span className="text-2xl font-bold tabular-nums">{mxn(total)}</span>
        </div>
        <Button size="xl" disabled={!compra} cargando={generar.isPending} onClick={() => generar.mutate()}>
          <QrCode /> Generar código de cobro
        </Button>
        <p className="text-center text-sm text-texto-suave">
          El cliente escanea el código con su app: se aplica su descuento y paga con CoDi o en efectivo.
        </p>
      </Contenido>
    </>
  );
}

/** Teclado numérico grande (monto en centavos, estilo caja registradora). */
function Teclado({ centavos, onChange }: { centavos: number; onChange: (c: number) => void }) {
  const tecla = (d: string) => {
    const nuevo = Number(String(centavos) + d);
    if (nuevo <= 10_000_000) onChange(nuevo);
  };
  return (
    <div className="space-y-3">
      <output
        className="block rounded-xl bg-superficie p-4 text-right text-4xl font-bold tabular-nums shadow-sm"
        aria-live="polite"
        aria-label="Monto de la compra"
      >
        {mxn(centavos)}
      </output>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"].map((d) => (
          <button key={d} onClick={() => tecla(d)} className="min-h-16 rounded-xl bg-superficie text-2xl font-bold shadow-sm active:bg-superficie-2">
            {d}
          </button>
        ))}
        <button
          onClick={() => onChange(Math.floor(centavos / 10))}
          onDoubleClick={() => onChange(0)}
          aria-label="Borrar"
          className="grid min-h-16 place-items-center rounded-xl bg-superficie shadow-sm active:bg-superficie-2"
        >
          <Delete className="size-7" />
        </button>
      </div>
    </div>
  );
}
