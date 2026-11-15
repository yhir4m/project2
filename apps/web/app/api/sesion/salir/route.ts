import { NextResponse } from "next/server";
import { cerrarSesion } from "@/lib/server/sesion";

export const POST = async () => {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
};
