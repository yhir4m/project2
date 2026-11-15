"use client";

import { Type } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { Cargando } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CelularForm } from "@/components/celular-form";
import { useActualizarYo, useYo } from "@/hooks/use-yo";

export default function Perfil() {
  const yo = useYo();
  const actualizar = useActualizarYo();
  if (!yo.data) return <Cargando />;
  const u = yo.data;

  return (
    <>
      <Encabezado titulo="Perfil" subtitulo={u.nombre ?? undefined} accion={<BotonSalir />} />
      <Contenido>
        <Card id="celular" className="space-y-3">
          <CardTitle>Celular para cobros CoDi</CardTitle>
          <p className="text-texto-suave">
            Al pagar, el cobro CoDi llega directo a tu app bancaria. Tu número nunca se muestra al negocio.
          </p>
          {u.tiene_celular ? (
            <div className="flex items-center justify-between rounded-lg bg-fondo p-3">
              <span className="text-lg font-semibold tabular-nums">{u.celular}</span>
              <Button
                variant="fantasma"
                ancho="auto"
                size="md"
                onClick={() => actualizar.mutate({ celular: null }, { onSuccess: () => toast("Celular eliminado") })}
              >
                Quitar
              </Button>
            </div>
          ) : (
            <CelularForm />
          )}
        </Card>

        <Card className="flex items-center gap-3">
          <Type className="size-7 shrink-0 text-acento" aria-hidden />
          <div className="flex-1">
            <p className="font-bold">Letra grande</p>
            <p className="text-sm text-texto-suave">Aumenta el tamaño de todo el texto.</p>
          </div>
          <button
            role="switch"
            aria-checked={u.letra_grande}
            aria-label="Letra grande"
            onClick={() => actualizar.mutate({ letra_grande: !u.letra_grande })}
            className={`relative h-9 w-16 shrink-0 rounded-full transition ${u.letra_grande ? "bg-primario" : "bg-borde"}`}
          >
            <span className={`absolute top-1 size-7 rounded-full bg-white shadow transition-all ${u.letra_grande ? "left-8" : "left-1"}`} />
          </button>
        </Card>

        <Button asChild variant="secundario">
          <Link href="/b/onboarding">Verificar otra institución</Link>
        </Button>
        <Button asChild variant="fantasma">
          <Link href="/privacidad">Aviso de privacidad</Link>
        </Button>
      </Contenido>
    </>
  );
}
