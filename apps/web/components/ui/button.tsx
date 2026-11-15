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
        primario: "bg-primario text-primario-texto shadow-sm hover:brightness-110",
        secundario: "border-2 border-borde bg-superficie text-texto hover:bg-fondo",
        exito: "bg-exito text-white shadow-sm hover:brightness-110 dark:text-fondo",
        peligro: "bg-error text-white hover:brightness-110 dark:text-fondo",
        fantasma: "text-primario hover:bg-primario/10",
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
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, ancho }), className)}
        disabled={disabled || cargando}
        aria-busy={cargando || undefined}
        {...props}
      >
        {cargando ? <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
