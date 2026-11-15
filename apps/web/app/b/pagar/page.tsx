"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, BadgePercent, ScanLine, Smartphone, Store, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Compra, ResultadoDescuento } from "@cdv/core";
import { Contenido, Encabezado } from "@/components/app-shell";
import { CelularForm } from "@/components/celular-form";
import { Escaner } from "@/components/escaner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { idDispositivo } from "@/hooks/use-dispositivo";
import type { VistaTx } from "@/hooks/use-transaccion";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";
import { mxn } from "@/lib/utils";

interface Previa {
  solicitud: { id: string; comercio: string; compra: Compra; total_centavos: number; expira_en: string };
  opciones: { credencial_id: string; emisor: string; convenio: string; regla: string; calculo: ResultadoDescuento }[];
  tiene_celular: boolean;
}

const MOTIVOS: Record<string, string> = {
  limite_diario: "Ya usaste este descuento las veces permitidas hoy.",
  sin_productos_elegibles: "Ningún producto de esta compra participa en tu convenio.",
  requiere_productos: "Tu convenio aplica solo a productos participantes.",
  monto_minimo: "La compra no alcanza el mínimo de tu convenio.",
};

/** Cliente · Pagar: escanea el código del negocio, revisa su descuento y paga. */
export default function Pagar() {
  const router = useRouter();
  const yo = useYo();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [revincular, setRevincular] = useState(false);

  const leer = useMutation({
    mutationFn: (contenido: string) => api<Previa>("/api/b/cobro/previsualizar", { method: "POST", json: { contenido } }),
    onSuccess: (p, contenido) => {
      navigator.vibrate?.(60);
      setCodigo(contenido);
      setPrevia(p);
      setElegida(p.opciones[0]?.credencial_id ?? null);
      setError(null);
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : "No pudimos leer el código."),
  });

  const pagar = useMutation({
    mutationFn: (metodo: "codi" | "efectivo") =>
      api<{ transaccion: VistaTx }>("/api/b/cobro/pagar", {
        method: "POST",
        json: {
          contenido: codigo,
          credencialId: elegida,
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
    setPrevia(null);
    setError(null);
  };
  const opcion = previa?.opciones.find((o) => o.credencial_id === elegida);
  const calc = opcion?.calculo;
  const tieneCelular = yo.data?.tiene_celular ?? previa?.tiene_celular ?? false;

  return (
    <>
      <Encabezado titulo="Pagar con descuento" subtitulo="Escanea el código del negocio" />
      <Contenido>
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-error-fondo p-8 text-center text-error">
                <XCircle className="size-14" aria-hidden />
                <p className="text-lg font-semibold text-texto">{error}</p>
              </div>
              <Button size="xl" onClick={reiniciar}>
                <ScanLine /> Escanear de nuevo
              </Button>
            </motion.div>
          ) : !previa ? (
            <motion.div key="escaner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Escaner
                onLeer={(t) => leer.mutate(t)}
                pausado={leer.isPending}
                permitirPegar={yo.data?.app.demo}
                indicacion="Apunta al código QR del negocio"
              />
              {leer.isPending ? <p className="mt-3 text-center font-semibold">Leyendo…</p> : null}
            </motion.div>
          ) : (
            <motion.div key="previa" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card className="flex items-center gap-3">
                <Store className="size-8 shrink-0 text-acento" aria-hidden />
                <div>
                  <p className="text-sm text-texto-suave">Pagas en</p>
                  <p className="text-xl font-bold">{previa.solicitud.comercio}</p>
                </div>
              </Card>

              {previa.solicitud.compra.tipo === "productos" ? (
                <ul className="divide-y divide-borde rounded-xl border border-borde bg-superficie px-4">
                  {previa.solicitud.compra.items.map((i) => (
                    <li key={i.sku} className="flex justify-between py-2">
                      <span>
                        {i.cantidad} × {i.nombre}
                      </span>
                      <span className="font-semibold tabular-nums">{mxn(i.precio_centavos * i.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {previa.opciones.length === 0 ? (
                <div role="alert" className="rounded-xl bg-aviso-fondo p-4 text-aviso">
                  <p className="font-bold">No tienes descuento en este negocio</p>
                  <p className="text-texto">Tus credenciales no tienen convenio aquí.</p>
                  <Button asChild variant="secundario" className="mt-3">
                    <Link href="/b">Ver dónde puedo usarlas</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {previa.opciones.length > 1 ? (
                    <fieldset className="space-y-2">
                      <legend className="mb-1 font-semibold">¿Qué credencial usas?</legend>
                      {previa.opciones.map((o) => (
                        <label key={o.credencial_id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-borde bg-superficie p-3 has-[:checked]:border-acento">
                          <input type="radio" name="cred" checked={elegida === o.credencial_id} onChange={() => setElegida(o.credencial_id)} className="size-5 accent-[var(--acento)]" />
                          <span className="flex-1">
                            <span className="block font-semibold">{o.emisor} · {o.convenio}</span>
                            <span className="block text-sm text-texto-suave">Ahorras {mxn(o.calculo.descuento_centavos)}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}

                  {calc && opcion ? (
                    <dl className="space-y-1 rounded-xl bg-superficie p-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-2 text-acento">
                        <BadgePercent className="size-5" aria-hidden />
                        <span className="font-semibold">{opcion.convenio}</span>
                      </div>
                      <div className="flex justify-between"><dt className="text-texto-suave">Precio</dt><dd className="font-semibold tabular-nums">{mxn(calc.precio_original_centavos)}</dd></div>
                      <div className="flex justify-between text-exito"><dt>Tu descuento</dt><dd className="font-semibold tabular-nums">− {mxn(calc.descuento_centavos)}</dd></div>
                      <div className="flex justify-between border-t border-borde pt-2 text-2xl"><dt className="font-bold">Total</dt><dd className="font-bold tabular-nums">{mxn(calc.monto_final_centavos)}</dd></div>
                      {!calc.aplicado && calc.motivo ? <p className="pt-1 text-sm font-semibold text-aviso">{MOTIVOS[calc.motivo]}</p> : null}
                      {yo.data?.app.modo_prueba ? (
                        <p className="pt-1 text-sm font-semibold text-aviso">Modo prueba: por CoDi se cobran ${yo.data.app.monto_prueba.toFixed(2)}.</p>
                      ) : null}
                    </dl>
                  ) : null}

                  {!tieneCelular ? (
                    <Card className="space-y-2">
                      <p className="font-bold">Para pagar con CoDi necesitamos tu celular</p>
                      <CelularForm boton="Guardar y continuar" />
                    </Card>
                  ) : null}

                  <Button
                    variant="exito"
                    size="xl"
                    disabled={!calc || !tieneCelular || calc.monto_final_centavos === 0}
                    cargando={pagar.isPending && pagar.variables === "codi"}
                    onClick={() => pagar.mutate("codi")}
                  >
                    <Smartphone /> Pagar {calc ? mxn(calc.monto_final_centavos) : ""} con CoDi
                  </Button>
                  <Button
                    variant="secundario"
                    disabled={!calc}
                    cargando={pagar.isPending && pagar.variables === "efectivo"}
                    onClick={() => pagar.mutate("efectivo")}
                  >
                    <Banknote /> Pagaré en efectivo
                  </Button>
                </>
              )}
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
