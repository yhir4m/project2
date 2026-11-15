"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BadgePercent, Banknote, Minus, Plus, ScanLine, Smartphone, Store, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import type { ResultadoDescuento } from "@cdv/core";
import { Contenido, Encabezado } from "@/components/app-shell";
import { CelularForm } from "@/components/celular-form";
import { Cargando } from "@/components/estados";
import { Escaner } from "@/components/escaner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { idDispositivo } from "@/hooks/use-dispositivo";
import type { VistaTx } from "@/hooks/use-transaccion";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";
import { mxn } from "@/lib/utils";

interface Previa {
  qr: { producto_id: string; comercio: string; concepto: string; precio_centavos: number };
  cantidad: number;
  total_centavos: number;
  opciones: { credencial_id: string; emisor: string; convenio: string; regla: string; calculo: ResultadoDescuento }[];
  tiene_celular: boolean;
}

const GENERAL = "general";
const MOTIVOS: Record<string, string> = {
  limite_diario: "Ya usaste este descuento las veces permitidas hoy.",
  sin_productos_elegibles: "Este producto no participa en tu convenio.",
  requiere_productos: "Tu convenio aplica solo a productos participantes.",
  monto_minimo: "La compra no alcanza el mínimo de tu convenio.",
};

export default function PagarPagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <Pagar />
    </Suspense>
  );
}

/** Quien paga: escanea el QR fijo del negocio, ve el precio y paga según su perfil. */
function Pagar() {
  const router = useRouter();
  const params = useSearchParams();
  const yo = useYo();
  const [codigo, setCodigo] = useState<string | null>(params.get("p"));
  const [cantidad, setCantidad] = useState(1);
  const [eleccion, setEleccion] = useState<string | null>(null);
  const [revincular, setRevincular] = useState(false);

  const previa = useQuery({
    queryKey: ["previa", codigo, cantidad],
    enabled: Boolean(codigo),
    queryFn: () => api<Previa>("/api/b/cobro/previsualizar", { method: "POST", json: { contenido: codigo, cantidad } }),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 0,
  });

  const pagar = useMutation({
    mutationFn: ({ metodo, credencialId }: { metodo: "codi" | "efectivo"; credencialId: string | null }) =>
      api<{ transaccion: VistaTx }>("/api/b/cobro/pagar", {
        method: "POST",
        json: {
          contenido: codigo,
          cantidad,
          credencialId,
          dispositivoId: idDispositivo(),
          metodo,
          ...(revincular ? { revincular: true } : {}),
        },
      }).then((r) => r.transaccion),
    onSuccess: (tx) => router.push(`/b/pago/${tx.id}`),
    onError: (e) => {
      if (e instanceof ErrorApi && e.codigo === "otro_dispositivo" && yo.data?.app.demo) {
        toast.error(e.message, { action: { label: "Usar este teléfono", onClick: () => setRevincular(true) } });
      } else toast.error(e instanceof ErrorApi ? e.message : "No se pudo completar el pago.");
    },
  });

  const reiniciar = () => {
    setCodigo(null);
    setCantidad(1);
    setEleccion(null);
    if (params.get("p")) router.replace("/b/pagar");
  };

  const p = previa.data;
  const elegida = eleccion ?? p?.opciones[0]?.credencial_id ?? GENERAL;
  const opcion = p?.opciones.find((o) => o.credencial_id === elegida) ?? null;
  const total = p?.total_centavos ?? 0;
  const descuento = opcion?.calculo.descuento_centavos ?? 0;
  const aPagar = opcion ? opcion.calculo.monto_final_centavos : total;
  const tieneCelular = yo.data?.tiene_celular ?? p?.tiene_celular ?? false;
  const credencialId = elegida === GENERAL ? null : elegida;

  return (
    <>
      <Encabezado titulo="Pagar" subtitulo="Escanea el QR del negocio" />
      <Contenido>
        <AnimatePresence mode="wait">
          {!codigo ? (
            <motion.div key="escaner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Escaner onLeer={(t) => setCodigo(t)} pausado={false} permitirPegar={yo.data?.app.demo} indicacion="Apunta al QR del negocio" />
            </motion.div>
          ) : previa.isError ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-error-fondo p-8 text-center text-error">
                <XCircle className="size-14" aria-hidden />
                <p className="text-lg font-semibold text-texto">
                  {previa.error instanceof ErrorApi ? previa.error.message : "No pudimos leer el código."}
                </p>
              </div>
              <Button size="xl" onClick={reiniciar}>
                <ScanLine /> Escanear de nuevo
              </Button>
            </motion.div>
          ) : !p ? (
            <Cargando texto="Leyendo el código…" />
          ) : (
            <motion.div key="previa" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card className="space-y-3">
                <div className="flex items-center gap-2 text-acento">
                  <Store className="size-5" aria-hidden />
                  <span className="font-semibold">{p.qr.comercio}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold">{p.qr.concepto}</p>
                    <p className="text-texto-suave">{mxn(p.qr.precio_centavos)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2" aria-label="Cantidad">
                    <Button variant="secundario" size="icono" ancho="auto" aria-label="Menos" disabled={cantidad <= 1} onClick={() => setCantidad((c) => c - 1)}>
                      <Minus />
                    </Button>
                    <span className="w-8 text-center text-xl font-bold tabular-nums" aria-live="polite">
                      {cantidad}
                    </span>
                    <Button variant="secundario" size="icono" ancho="auto" aria-label="Más" disabled={cantidad >= 20} onClick={() => setCantidad((c) => c + 1)}>
                      <Plus />
                    </Button>
                  </div>
                </div>
              </Card>

              <fieldset className="space-y-2">
                <legend className="mb-1 font-semibold">¿Cómo pagas?</legend>
                {p.opciones.map((o) => (
                  <label
                    key={o.credencial_id}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-borde bg-superficie p-3 has-[:checked]:border-acento"
                  >
                    <input type="radio" name="perfil" checked={elegida === o.credencial_id} onChange={() => setEleccion(o.credencial_id)} className="size-5 accent-[var(--acento)]" />
                    <span className="flex-1">
                      <span className="block font-semibold">
                        Con descuento {o.emisor} · {o.convenio}
                      </span>
                      <span className="block text-sm text-texto-suave">
                        {o.calculo.aplicado ? `Ahorras ${mxn(o.calculo.descuento_centavos)}` : (MOTIVOS[o.calculo.motivo ?? ""] ?? "Sin descuento en esta compra")}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-borde bg-superficie p-3 has-[:checked]:border-acento">
                  <input type="radio" name="perfil" checked={elegida === GENERAL} onChange={() => setEleccion(GENERAL)} className="size-5 accent-[var(--acento)]" />
                  <span className="flex-1">
                    <span className="block font-semibold">Precio general</span>
                    <span className="block text-sm text-texto-suave">
                      {p.opciones.length ? "Sin usar tu credencial" : "No tienes credencial con convenio aquí"}
                    </span>
                  </span>
                </label>
              </fieldset>

              <dl className="space-y-1 rounded-xl bg-superficie p-4 shadow-sm" aria-live="polite">
                {opcion ? (
                  <div className="flex items-center gap-2 pb-2 text-acento">
                    <BadgePercent className="size-5" aria-hidden />
                    <span className="font-semibold">{opcion.regla}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-texto-suave">Precio</dt>
                  <dd className="font-semibold tabular-nums">{mxn(total)}</dd>
                </div>
                {descuento ? (
                  <div className="flex justify-between text-exito">
                    <dt>Tu descuento</dt>
                    <dd className="font-semibold tabular-nums">− {mxn(descuento)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-borde pt-2 text-2xl">
                  <dt className="font-bold">Total a pagar</dt>
                  <dd className="font-bold tabular-nums">{mxn(aPagar)}</dd>
                </div>
                {yo.data?.app.modo_prueba ? (
                  <p className="pt-1 text-sm font-semibold text-aviso">Modo prueba: por CoDi se cobran ${yo.data.app.monto_prueba.toFixed(2)}.</p>
                ) : null}
              </dl>

              {!tieneCelular ? (
                <Card className="space-y-2">
                  <p className="font-bold">Para pagar con CoDi necesitamos tu celular</p>
                  <CelularForm boton="Guardar y continuar" />
                </Card>
              ) : null}

              <Button
                variant="exito"
                size="xl"
                disabled={!tieneCelular || aPagar === 0 || previa.isFetching}
                cargando={pagar.isPending && pagar.variables?.metodo === "codi"}
                onClick={() => pagar.mutate({ metodo: "codi", credencialId })}
              >
                <Smartphone /> Pagar {mxn(aPagar)} con CoDi
              </Button>
              <Button
                variant="secundario"
                disabled={previa.isFetching}
                cargando={pagar.isPending && pagar.variables?.metodo === "efectivo"}
                onClick={() => pagar.mutate({ metodo: "efectivo", credencialId })}
              >
                <Banknote /> Pagaré en efectivo
              </Button>
              <Button variant="fantasma" onClick={reiniciar}>
                Cancelar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Contenido>
    </>
  );
}
