import { redirect } from "next/navigation";
import { env } from "@/lib/server/env";
import { usuarioActual } from "@/lib/server/sesion";
import { ElegirPagador } from "../../elegir-pagador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagar" };

/**
 * Destino del QR fijo de un producto. Se abre con la cámara normal del celular.
 * Con sesión → directo a pagar; sin sesión → elegir/entrar y continuar.
 */
export default async function PagarProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/");
  const destino = `/b/pagar?p=${id}`;
  const u = await usuarioActual();
  if (u?.rol === "beneficiario") redirect(destino);
  return <ElegirPagador destino={destino} demo={env().DEMO_MODE} />;
}
