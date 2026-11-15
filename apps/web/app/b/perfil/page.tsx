"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Type } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { Cargando } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Ayuda, Input, Label } from "@/components/ui/input";
import { useActualizarYo, useYo } from "@/hooks/use-yo";
import { ErrorApi } from "@/lib/api";

const CelularSchema = z.object({
  celular: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^52(1)?/, ""))
    .pipe(z.string().regex(/^\d{10}$/, "Escribe tu celular a 10 dígitos")),
});

export default function Perfil() {
  const yo = useYo();
  const actualizar = useActualizarYo();
  const form = useForm<z.input<typeof CelularSchema>, unknown, z.output<typeof CelularSchema>>({
    resolver: zodResolver(CelularSchema),
    defaultValues: { celular: "" },
  });

  if (!yo.data) return <Cargando />;
  const u = yo.data;

  return (
    <>
      <Encabezado titulo="Perfil" subtitulo={u.nombre ?? undefined} accion={<BotonSalir />} />
      <Contenido>
        <Card id="celular" className="space-y-3">
          <CardTitle>Celular para cobros CoDi</CardTitle>
          <p className="text-texto-suave">
            Con tu celular, el negocio te envía el cobro directo a tu app bancaria. Tu número nunca se muestra al negocio ni va
            en tu código QR.
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
            <form
              noValidate
              onSubmit={form.handleSubmit(async ({ celular }) => {
                try {
                  await actualizar.mutateAsync({ celular });
                  toast.success("Celular guardado");
                  form.reset();
                } catch (e) {
                  toast.error(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
                }
              })}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="cel">Celular (10 dígitos)</Label>
                <Input
                  id="cel"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="993 123 4567"
                  aria-invalid={Boolean(form.formState.errors.celular)}
                  {...form.register("celular")}
                />
                {form.formState.errors.celular ? <Ayuda error>{form.formState.errors.celular.message}</Ayuda> : null}
              </div>
              <Button type="submit" cargando={actualizar.isPending}>
                Guardar celular
              </Button>
            </form>
          )}
        </Card>

        <Card className="flex items-center gap-3">
          <Type className="size-7 shrink-0 text-primario" aria-hidden />
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
