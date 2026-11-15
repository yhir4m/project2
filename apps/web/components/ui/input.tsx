import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-14 w-full rounded-xl border-2 border-borde bg-superficie px-4 text-lg text-texto placeholder:text-texto-suave/70 focus:border-acento focus:outline-none aria-[invalid=true]:border-error",
        className,
      )}
      {...p}
    />
  ),
);
Input.displayName = "Input";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-base font-semibold", className)} {...p} />;
}

export function Ayuda({ error, children }: { error?: boolean; children: React.ReactNode }) {
  return <p className={cn("mt-1.5 text-sm", error ? "font-semibold text-error" : "text-texto-suave")}>{children}</p>;
}
