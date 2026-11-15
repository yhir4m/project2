import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold", {
  variants: {
    tono: {
      neutro: "bg-fondo text-texto-suave border border-borde",
      exito: "bg-exito-fondo text-exito",
      error: "bg-error-fondo text-error",
      aviso: "bg-aviso-fondo text-aviso",
      primario: "bg-primario/10 text-acento",
    },
  },
  defaultVariants: { tono: "neutro" },
});

export function Badge({ className, tono, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tono }), className)} {...p} />;
}
