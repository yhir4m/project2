"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NavIcono, type NombreIcono } from "./nav-icono";

export interface ItemNav {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Coincidencia exacta (para la raíz de la sección). */
  exacto?: boolean;
}

/** Contenedor tipo app: max-w-md, header fijo, contenido con scroll y bottom tab bar. */
export function AppShell({ nav, children }: { nav: ItemNav[]; children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-fondo sm:my-0 sm:shadow-2xl">
      <main className="flex-1 pb-[calc(var(--alto-nav)+env(safe-area-inset-bottom)+16px)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={path}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav items={nav} />
    </div>
  );
}

function BottomNav({ items }: { items: ItemNav[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-borde bg-superficie/95 backdrop-blur"
    >
      <ul className="grid h-[var(--alto-nav)]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const activo = it.exacto ? path === it.href : path === it.href || path.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-12 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors",
                  activo ? "text-acento" : "text-texto-suave",
                )}
              >
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition", activo && "bg-primario/12")}>
                  <NavIcono nombre={it.icono} className="size-6" />
                </span>
                {it.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Header fijo de cada pantalla. */
export function Encabezado({
  titulo,
  atras,
  accion,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
  atras?: string | true;
  accion?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-borde/60 bg-fondo/95 backdrop-blur">
      <div className="flex min-h-[var(--alto-header)] items-center gap-2 px-4">
        {atras ? (
          atras === true ? (
            <button onClick={() => router.back()} className="-ml-2 grid size-12 place-items-center rounded-full" aria-label="Regresar">
              <ArrowLeft className="size-6" />
            </button>
          ) : (
            <Link href={atras} className="-ml-2 grid size-12 place-items-center rounded-full" aria-label="Regresar">
              <ArrowLeft className="size-6" />
            </Link>
          )
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-tight">{titulo}</h1>
          {subtitulo ? <p className="truncate text-sm text-texto-suave">{subtitulo}</p> : null}
        </div>
        {accion}
      </div>
    </header>
  );
}

export function BotonSalir() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/sesion/salir", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      className="grid size-12 place-items-center rounded-full text-texto-suave"
      aria-label="Cambiar de rol"
    >
      <LogOut className="size-6" />
    </button>
  );
}

export function Contenido({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-4 px-4 py-4", className)}>{children}</div>;
}
