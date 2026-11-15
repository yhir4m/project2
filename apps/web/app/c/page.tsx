"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, CheckCircle2, Delete, ScanLine, Smartphone, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Compra, ResultadoDescuento } from "@cdv/core";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { Escaner } from "@/components/comercio/escaner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { VistaTx } from "@/hooks/use-transaccion";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";
import { mxn } from "@/lib/utils";

type Escaneo =
  | {
      ok: true;
      verificacion: string;
      expira_en: string;
      emisor: string;
      tipo_beneficiario: string;
      convenio: { id: string; nombre: string; descripcion: string | null; regla: string };
      cobro_al_celular: boolean;
    }
  | { ok: false; error: string; mensaje: string };

const TIPOS: Record<string, string> = { estudiante: "Estudiante", adulto_mayor: "Adulto mayor" };

/** Flujo del comercio en una sola pantalla: escanear → resultado → cobrar. */
export default function Comercio() {
  const yo = useYo();
  const [resultado, setResultado] = useState<Escaneo | null>(null);

  const escanear = useMutation({
    mutationFn: async (contenido: string) => {
      try {
        return await api<Escaneo>("/api/c/escanear", { method: "POST", json: { contenido } });
      } catch (e) {
        if (e instanceof ErrorApi && e.status === 422 && e.datos) return e.datos as Escaneo;
        throw e;
      }
    },
    onSuccess: (r) => {
      setResultado(r);
      navigator.vibrate?.(r.ok ? [60] : [80, 60, 80]);
    },
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No pudimos validar el código."),
  });

  return (
    <>
      <Encabezado titulo={yo.data?.comercio?.nombre ?? "Cobrar"} subtitulo="Descuentos verificados" accion={<BotonSalir />} />
      <Contenido>
        <AnimatePresence mode="wait">
          {!resultado ? (
            <motion.div key="escaner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Escaner onLeer={(t) => escanear.mutate(t)} pausado={escanear.isPending} permitirPegar={yo.data?.app.demo} />
              {escanear.isPending ? <p className="mt-3 text-center font-semibold">Validando…</p> : null}
            </motion.div>
          ) : resultado.ok ? (
            <motion.div key="cobro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Cobro escaneo={resultado} onCancelar={() => setResultado(null)} />
            </motion.div>
          ) : (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-error-fondo p-8 text-center text-error">
                <XCircle className="size-16" aria-hidden />
                <p className="text-2xl font-bold">No válido</p>
                <p className="text-lg text-texto">{resultado.mensaje}</p>
              </div>
              <Button size="xl" onClick={() => setResultado(null)}>
                <ScanLine /> Escanear otra vez
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Contenido>
    </>
  );
}

function Cobro({ escaneo, onCancelar }: { escaneo: Extract<Escaneo, { ok: true }>; onCancelar: () => void }) {
  const router = useRouter();
  const [modo, setModo] = useState<"monto" | "productos">("monto");
  const [centavos, setCentavos] = useState(0);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const productos = useQuery({
    queryKey: ["productos"],
    queryFn: () => api<{ productos: { sku: string; nombre: string; precio_centavos: number }[] }>("/api/c/productos").then((r) => r.productos),
  });

  const compra: Compra | null =
    modo === "monto"
      ? centavos > 0
        ? { tipo: "monto", monto_centavos: centavos }
        : null
      : Object.keys(carrito).length
        ? {
            tipo: "productos",
            items: Object.entries(carrito).map(([sku, cantidad]) => {
              const p = productos.data!.find((x) => x.sku === sku)!;
              return { sku, nombre: p.nombre, precio_centavos: p.precio_centavos, cantidad };
            }),
          }
        : null;

  // El descuento SIEMPRE lo calcula el servidor.
  const cotizacion = useQuery({
    queryKey: ["cotizar", escaneo.verificacion, compra],
    enabled: Boolean(compra),
    queryFn: () => api<{ calculo: ResultadoDescuento }>("/api/c/cotizar", { method: "POST", json: { verificacion: escaneo.verificacion, compra } }).then((r) => r.calculo),
    placeholderData: (prev) => prev,
  });

  const cobrar = useMutation({
    mutationFn: (metodo: "codi" | "efectivo") =>
      api<{ transaccion: VistaTx }>("/api/c/cobros", { method: "POST", json: { verificacion: escaneo.verificacion, compra, metodo } }).then((r) => r.transaccion),
    onSuccess: (tx) => router.push(`/c/cobro/${tx.id}`),
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo crear el cobro."),
  });

  const calc = compra ? cotizacion.data : undefined;

  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3 border-exito/40 bg-exito-fondo">
        <CheckCircle2 className="size-10 shrink-0 text-exito" aria-hidden />
        <div className="min-w-0">
          <p className="text-xl font-bold text-exito">Descuento válido</p>
          <p className="font-semibold">{escaneo.convenio.nombre}</p>
          <p className="text-sm text-texto-suave">{escaneo.convenio.regla}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tono="primario">{escaneo.emisor}</Badge>
            <Badge>{TIPOS[escaneo.tipo_beneficiario] ?? escaneo.tipo_beneficiario}</Badge>
          </div>
        </div>
      </Card>

      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-borde/40 p-1">
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
                <Button variant="secundario" size="icono" ancho="auto" aria-label={`Quitar ${p.nombre}`} disabled={!n}
                  onClick={() => setCarrito(({ [p.sku]: actual = 0, ...resto }) => (actual > 1 ? { ...resto, [p.sku]: actual - 1 } : resto))}>
                  −
                </Button>
                <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">{n}</span>
                <Button variant="secundario" size="icono" ancho="auto" aria-label={`Agregar ${p.nombre}`}
                  onClick={() => setCarrito((c) => ({ ...c, [p.sku]: (c[p.sku] ?? 0) + 1 }))}>
                  +
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {calc ? (
        <dl className="space-y-1 rounded-xl bg-superficie p-4 shadow-sm" aria-live="polite">
          <div className="flex justify-between"><dt className="text-texto-suave">Precio</dt><dd className="font-semibold">{mxn(calc.precio_original_centavos)}</dd></div>
          <div className="flex justify-between text-exito"><dt>Descuento</dt><dd className="font-semibold">− {mxn(calc.descuento_centavos)}</dd></div>
          <div className="flex justify-between border-t border-borde pt-2 text-xl"><dt className="font-bold">Total</dt><dd className="font-bold">{mxn(calc.monto_final_centavos)}</dd></div>
          {!calc.aplicado && calc.motivo ? (
            <p className="pt-1 text-sm font-semibold text-aviso">
              {{ limite_diario: "Ya usó su descuento las veces permitidas hoy.", sin_productos_elegibles: "Ningún producto participa en el convenio.", requiere_productos: "Este convenio aplica a productos: usa la pestaña “Productos”.", monto_minimo: "La compra no alcanza el mínimo del convenio." }[calc.motivo]}
            </p>
          ) : null}
        </dl>
      ) : null}

      <div className="space-y-2">
        <Button size="xl" disabled={!calc || calc.monto_final_centavos === 0} cargando={cobrar.isPending && cobrar.variables === "codi"} onClick={() => cobrar.mutate("codi")}>
          <Smartphone /> Cobrar con CoDi {calc ? mxn(calc.monto_final_centavos) : ""}
        </Button>
        <p className="text-center text-sm text-texto-suave">
          {escaneo.cobro_al_celular ? "El cobro llegará a la app bancaria del cliente." : "Se mostrará un QR de cobro para que el cliente lo escanee."}
        </p>
        <Button variant="secundario" disabled={!calc} cargando={cobrar.isPending && cobrar.variables === "efectivo"} onClick={() => cobrar.mutate("efectivo")}>
          <Banknote /> Registrar pago en efectivo
        </Button>
        <Button variant="fantasma" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
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
      <output className="block rounded-xl bg-superficie p-4 text-right text-4xl font-bold tabular-nums shadow-sm" aria-live="polite" aria-label="Monto de la compra">
        {mxn(centavos)}
      </output>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"].map((d) => (
          <button key={d} onClick={() => tecla(d)} className="min-h-16 rounded-xl bg-superficie text-2xl font-bold shadow-sm active:bg-borde/50">
            {d}
          </button>
        ))}
        <button onClick={() => onChange(Math.floor(centavos / 10))} onDoubleClick={() => onChange(0)} aria-label="Borrar" className="grid min-h-16 place-items-center rounded-xl bg-superficie shadow-sm active:bg-borde/50">
          <Delete className="size-7" />
        </button>
      </div>
    </div>
  );
}

