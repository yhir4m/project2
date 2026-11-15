"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Ayuda, Input, Label } from "@/components/ui/input";
import { useActualizarYo } from "@/hooks/use-yo";
import { ErrorApi } from "@/lib/api";

const CelularSchema = z.object({
  celular: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^52(1)?/, ""))
    .pipe(z.string().regex(/^\d{10}$/, "Escribe tu celular a 10 dígitos")),
});

/** Celular para recibir el cobro CoDi en la app bancaria. Nunca se comparte con el negocio. */
export function CelularForm({ onListo, boton = "Guardar celular" }: { onListo?: () => void; boton?: string }) {
  const actualizar = useActualizarYo();
  const form = useForm<z.input<typeof CelularSchema>, unknown, z.output<typeof CelularSchema>>({
    resolver: zodResolver(CelularSchema),
    defaultValues: { celular: "" },
  });
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={form.handleSubmit(async ({ celular }) => {
        try {
          await actualizar.mutateAsync({ celular });
          toast.success("Celular guardado");
          form.reset();
          onListo?.();
        } catch (e) {
          toast.error(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
        }
      })}
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
        {form.formState.errors.celular ? (
          <Ayuda error>{form.formState.errors.celular.message}</Ayuda>
        ) : (
          <Ayuda>El cobro CoDi te llegará a la app de tu banco. El negocio nunca ve tu número.</Ayuda>
        )}
      </div>
      <Button type="submit" cargando={actualizar.isPending}>
        {boton}
      </Button>
    </form>
  );
}
