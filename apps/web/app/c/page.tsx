"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, QrCode } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ayuda, Input, Label } from "@/components/ui/input";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";
import { mxn } from "@/lib/utils";

export interface QrFijo {
  id: string;
  nombre: string;
  precio_centavos: number;
  activo: boolean;
  url: string;
}

/**
 * Comercio · Mis QR: cada QR es fijo y tiene su precio configurado una sola vez.
 * El cliente lo escanea, ve el precio y paga con su descuento (o a precio general).
 */
export default function MisQr() {
  const yo = useYo();
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState(false);
  const q = useQuery({ queryKey: ["qrs"], queryFn: () => api<{ qrs: QrFijo[] }>("/api/c/qrs").then((r) => r.qrs) });
  const alternar = useMutation({
    mutationFn: (x: QrFijo) => api(`/api/c/qrs/${x.id}`, { method: "PATCH", json: { activo: !x.activo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qrs"] }),
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo actualizar."),
  });
  const activos = q.data?.filter((x) => x.activo) ?? [];
  const inactivos = q.data?.filter((x) => !x.activo) ?? [];

  return (
    <>
      <Encabezado titulo="Mis QR de cobro" subtitulo={yo.data?.comercio?.nombre} accion={<BotonSalir />} />
      <Contenido>
        <p className="text-texto-suave">
          Cada QR tiene un precio fijo. Imprímelo o muéstralo: el cliente lo escanea con su celular, ve el precio y paga con su
          descuento de estudiante o INAPAM, o a precio general.
        </p>
        {nuevo ? (
          <NuevoQr onListo={() => setNuevo(false)} />
        ) : (
          <Button onClick={() => setNuevo(true)}>
            <Plus /> Nuevo QR con precio
          </Button>
        )}

        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar tus QR." reintentar={() => q.refetch()} />
        ) : !activos.length ? (
          <Vacio titulo="Aún no tienes QR activos" icono={<QrCode />}>
            Crea uno por cada producto o servicio que cobres.
          </Vacio>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {activos.map((x) => (
              <li key={x.id}>
                <Card className="flex h-full flex-col gap-2 p-3">
                  <Link href={`/c/qr/${x.id}`} className="block rounded-lg bg-white p-2" aria-label={`Ver QR de ${x.nombre}`}>
                    <QRCodeSVG value={x.url} level="M" className="h-auto w-full" fgColor="#1A252B" />
                  </Link>
                  <p className="font-semibold leading-tight">{x.nombre}</p>
                  <p className="text-xl font-bold tabular-nums">{mxn(x.precio_centavos)}</p>
                  <div className="mt-auto grid gap-1">
                    <Button asChild size="md" variant="secundario">
                      <Link href={`/c/qr/${x.id}`}>
                        <Printer /> Mostrar / imprimir
                      </Link>
                    </Button>
                    <Button size="md" variant="fantasma" cargando={alternar.isPending && alternar.variables?.id === x.id} onClick={() => alternar.mutate(x)}>
                      Desactivar
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {inactivos.length ? (
          <details className="rounded-xl border border-borde bg-superficie p-3">
            <summary className="min-h-12 cursor-pointer content-center font-semibold">QR desactivados ({inactivos.length})</summary>
            <ul className="mt-2 divide-y divide-borde">
              {inactivos.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {x.nombre} · <span className="tabular-nums">{mxn(x.precio_centavos)}</span>
                  </span>
                  <Badge>Inactivo</Badge>
                  <Button size="md" ancho="auto" variant="secundario" onClick={() => alternar.mutate(x)}>
                    Activar
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Contenido>
    </>
  );
}

const Form = z.object({
  nombre: z.string().trim().min(2, "Escribe qué se cobra").max(80),
  precio: z
    .string()
    .transform((v) => Number(v.replace(/[$,\s]/g, "")))
    .pipe(z.number({ message: "Escribe un precio válido" }).min(1, "Mínimo $1.00").max(50_000, "Máximo $50,000")),
});

function NuevoQr({ onListo }: { onListo: () => void }) {
  const qc = useQueryClient();
  const f = useForm<z.input<typeof Form>, unknown, z.output<typeof Form>>({
    resolver: zodResolver(Form),
    defaultValues: { nombre: "", precio: "" },
  });
  return (
    <Card>
      <form
        noValidate
        className="space-y-3"
        onSubmit={f.handleSubmit(async ({ nombre, precio }) => {
          try {
            await api("/api/c/qrs", { method: "POST", json: { nombre, precio_centavos: Math.round(precio * 100) } });
            toast.success("QR creado");
            await qc.invalidateQueries({ queryKey: ["qrs"] });
            onListo();
          } catch (e) {
            toast.error(e instanceof ErrorApi ? e.message : "No se pudo crear.");
          }
        })}
      >
        <div>
          <Label htmlFor="nombre">¿Qué cobras con este QR?</Label>
          <Input id="nombre" placeholder="Ej. Café latte, Copias, Corte de cabello" aria-invalid={Boolean(f.formState.errors.nombre)} {...f.register("nombre")} />
          {f.formState.errors.nombre ? <Ayuda error>{f.formState.errors.nombre.message}</Ayuda> : null}
        </div>
        <div>
          <Label htmlFor="precio">Precio</Label>
          <Input id="precio" inputMode="decimal" placeholder="$0.00" aria-invalid={Boolean(f.formState.errors.precio)} {...f.register("precio")} />
          {f.formState.errors.precio ? (
            <Ayuda error>{f.formState.errors.precio.message}</Ayuda>
          ) : (
            <Ayuda>El precio queda fijo en este QR. Para cambiarlo, crea uno nuevo y desactiva este.</Ayuda>
          )}
        </div>
        <Button type="submit" cargando={f.formState.isSubmitting}>
          Crear QR
        </Button>
        <Button type="button" variant="fantasma" onClick={onListo}>
          Cancelar
        </Button>
      </form>
    </Card>
  );
}
