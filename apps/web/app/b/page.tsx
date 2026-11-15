"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Clock, Phone, Plus, ScanLine, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useYo } from "@/hooks/use-yo";
import { useCredenciales } from "@/hooks/use-credenciales";
import { api } from "@/lib/api";
import { fechaLarga } from "@/lib/utils";

const TIPOS: Record<string, string> = { estudiante: "Estudiante", adulto_mayor: "Adulto mayor" };

export default function Cartera() {
  const yo = useYo();
  const q = useCredenciales();
  const notis = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => api<{ notificaciones: { leida: boolean }[] }>("/api/notificaciones").then((r) => r.notificaciones),
    refetchInterval: 15_000,
  });
  const sinLeer = notis.data?.filter((n) => !n.leida).length ?? 0;
  const activas = q.data?.credenciales.filter((c) => c.estado === "activa") ?? [];

  return (
    <>
      <Encabezado
        titulo={yo.data?.nombre ? `Hola, ${yo.data.nombre}` : "Mi cartera"}
        subtitulo="Tus credenciales de descuento"
        accion={
          <div className="flex">
            <Link href="/b/notificaciones" className="relative grid size-12 place-items-center rounded-full" aria-label={`Notificaciones${sinLeer ? `, ${sinLeer} sin leer` : ""}`}>
              <Bell className="size-6" />
              {sinLeer ? <span className="absolute right-2 top-2 grid min-w-5 place-items-center rounded-full bg-error px-1 text-xs font-bold text-white">{sinLeer}</span> : null}
            </Link>
            <BotonSalir />
          </div>
        }
      />
      <Contenido>
        {yo.data && !yo.data.tiene_celular && activas.length > 0 ? (
          <Link href="/b/perfil#celular" className="flex items-center gap-3 rounded-xl bg-primario/10 p-4 text-acento">
            <Phone className="size-6 shrink-0" aria-hidden />
            <span className="flex-1 font-semibold">Agrega tu celular: el cobro CoDi te llega directo a tu app bancaria.</span>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : null}

        {q.isLoading ? (
          <Esqueleto filas={2} />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar tus credenciales." reintentar={() => q.refetch()} />
        ) : q.data!.credenciales.length === 0 ? (
          <Vacio titulo="Aún no tienes credenciales" icono={<ShieldCheck />}>
            <p className="mb-4">Verifica una sola vez que eres estudiante o adulto mayor y usa tu descuento con un escaneo.</p>
            <Button asChild>
              <Link href="/b/onboarding">Verificar mi descuento</Link>
            </Button>
          </Vacio>
        ) : (
          <>
            {q.data!.verificaciones_en_curso.length ? (
              <Card className="flex items-center gap-3 border-aviso/40 bg-aviso-fondo text-aviso">
                <Clock className="size-6 shrink-0" aria-hidden />
                <p className="font-semibold">Tienes una verificación en revisión. Te avisaremos cuando esté lista.</p>
              </Card>
            ) : null}
            {q.data!.credenciales.map((c) => (
              <Card key={c.id} className="space-y-3 p-0">
                <div className="rounded-t-xl bg-gradient-to-br from-primario to-primario/70 p-4 text-primario-texto">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold opacity-90">{c.emisor}</p>
                      <p className="text-2xl font-bold">{TIPOS[c.tipo_beneficiario] ?? c.tipo_beneficiario}</p>
                    </div>
                    <Badge tono={c.estado === "activa" ? "exito" : "error"} className="bg-white/90">
                      {c.estado === "activa" ? "Vigente" : c.estado === "revocada" ? "Dada de baja" : "Vencida"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm opacity-90">Válida hasta el {fechaLarga(c.vigente_hasta)}</p>
                </div>
                <div className="space-y-2 px-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-texto-suave">Dónde usarla</p>
                  {c.convenios.map((v) => (
                    <div key={v.id} className="rounded-lg bg-fondo p-3">
                      <p className="font-semibold">{v.nombre}</p>
                      <p className="text-sm text-texto-suave">{v.regla}</p>
                      <ul className="mt-1 space-y-0.5">
                        {v.comercios.map((x) => (
                          <li key={x.id} className="flex items-center gap-1.5 text-sm">
                            <Store className="size-4 text-texto-suave" aria-hidden /> {x.nombre}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  {c.estado === "activa" ? (
                    <Button asChild size="xl">
                      <Link href="/b/pagar">
                        <ScanLine /> Pagar con descuento
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="secundario">
                      <Link href="/b/onboarding">Verificarme de nuevo</Link>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            <Button asChild variant="fantasma">
              <Link href="/b/onboarding">
                <Plus /> Agregar otra institución
              </Link>
            </Button>
          </>
        )}
      </Contenido>
    </>
  );
}
