import type { ReactNode } from "react";
import { AppShell, type ItemNav } from "@/components/app-shell";
import { guardiaRol } from "@/lib/server/guardia";

export const dynamic = "force-dynamic";

const NAV: ItemNav[] = [
  { href: "/b", etiqueta: "Cartera", icono: "cartera", exacto: true },
  { href: "/b/pagar", etiqueta: "Pagar", icono: "escanear" },
  { href: "/b/historial", etiqueta: "Historial", icono: "historial" },
  { href: "/b/perfil", etiqueta: "Perfil", icono: "perfil" },
];

export default async function LayoutBeneficiario({ children }: { children: ReactNode }) {
  await guardiaRol("beneficiario");
  return <AppShell nav={NAV}>{children}</AppShell>;
}
