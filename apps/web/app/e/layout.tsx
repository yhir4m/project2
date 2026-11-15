import type { ReactNode } from "react";
import { AppShell, type ItemNav } from "@/components/app-shell";
import { guardiaRol } from "@/lib/server/guardia";

export const dynamic = "force-dynamic";

const NAV: ItemNav[] = [
  { href: "/e", etiqueta: "Convenios", icono: "convenios", exacto: true },
  { href: "/e/revision", etiqueta: "Revisión", icono: "revision" },
  { href: "/e/credenciales", etiqueta: "Credenciales", icono: "credenciales" },
  { href: "/e/reportes", etiqueta: "Reportes", icono: "reportes" },
];

export default async function LayoutEmisor({ children }: { children: ReactNode }) {
  await guardiaRol("emisor");
  return <AppShell nav={NAV}>{children}</AppShell>;
}
