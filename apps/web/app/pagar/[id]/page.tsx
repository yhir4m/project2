import { redirect } from "next/navigation";
import { env } from "@/lib/server/env";
import { usuarioActual } from "@/lib/server/sesion";
import { ElegirPagador } from "./elegir-pagador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagar con descuento" };

/**
 * Destino del QR del negocio. Se abre con la cámara normal del celular (no requiere el lector de la app).
 * Con sesión de beneficiario → directo a pagar; si no, primero elegir/entrar.
 */
export default async function PagarEnlace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/");
  const destino = `/b/pagar?s=${id}`;
  const u = await usuarioActual();
  if (u?.rol === "beneficiario") redirect(destino);
  return <ElegirPagador destino={destino} demo={env().DEMO_MODE} />;
}
