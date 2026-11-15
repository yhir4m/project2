import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-texto-suave">
      <span className="size-10 animate-spin rounded-full border-4 border-borde border-t-primario" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

export function Esqueleto({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-borde/50" />
      ))}
    </div>
  );
}

export function Vacio({ titulo, children, icono }: { titulo: string; children?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-primario/10 text-primario [&_svg]:size-8">{icono ?? <Inbox />}</div>
      <h2 className="text-lg font-bold">{titulo}</h2>
      {children ? <div className="text-texto-suave">{children}</div> : null}
    </div>
  );
}

export function ErrorEstado({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl bg-error-fondo px-6 py-10 text-center">
      <AlertTriangle className="size-10 text-error" aria-hidden />
      <p className="font-semibold text-error">{mensaje}</p>
      {reintentar ? (
        <Button variant="secundario" ancho="auto" onClick={reintentar}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
