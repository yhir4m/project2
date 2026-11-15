import type { ReactNode } from "react";
import { AppShell, type ItemNav } from "@/components/app-shell";
import { guardiaRol } from "@/lib/server/guardia";

export const dynamic = "force-dynamic";

const NAV: ItemNav[] = [
  { href: "/c", etiqueta: "Mis QR", icono: "qr", exacto: true },
  { href: "/c/corte", etiqueta: "Pagos de hoy", icono: "corte" },
];

export default async function LayoutComercio({ children }: { children: ReactNode }) {
  await guardiaRol("comercio");
  return <AppShell nav={NAV}>{children}</AppShell>;
}
