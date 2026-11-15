import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Botón estilo shadcn/ui adaptado a móvil: mínimo 48 px de alto, texto grande. */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-6 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primario: "bg-primario text-primario-texto shadow-sm hover:brightness-105",
        secundario: "border-2 border-borde bg-superficie text-texto hover:bg-fondo",
        exito: "bg-accion text-accion-texto shadow-sm hover:brightness-105",
        peligro: "bg-error text-white hover:brightness-110 dark:text-fondo",
        fantasma: "text-acento hover:bg-primario/10",
      },
      size: {
        md: "min-h-12 px-5 text-base",
        lg: "min-h-14 px-6 text-lg",
        xl: "min-h-16 px-6 text-xl",
        icono: "size-12",
      },
      ancho: { completo: "w-full", auto: "" },
    },
    defaultVariants: { variant: "primario", size: "lg", ancho: "completo" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  cargando?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ancho, asChild, cargando, children, disabled, ...props }, ref) => {
    const clases = cn(buttonVariants({ variant, size, ancho }), className);
    // Con asChild, Radix Slot exige UN solo hijo: se pasa tal cual (sin spinner).
    if (asChild) {
      return (
        <Slot ref={ref} className={clases} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} className={clases} disabled={disabled || cargando} aria-busy={cargando || undefined} {...props}>
        {cargando ? <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
