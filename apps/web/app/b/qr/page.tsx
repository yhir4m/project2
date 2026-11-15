"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RefreshCw, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado, Vacio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { useCredenciales } from "@/hooks/use-credenciales";
import { idDispositivo } from "@/hooks/use-dispositivo";
import { api, ErrorApi } from "@/lib/api";

const TTL = 45;

export default function MiQrPagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <MiQr />
    </Suspense>
  );
}

function MiQr() {
  const params = useSearchParams();
  const router = useRouter();
  const creds = useCredenciales();
  const activas = useMemo(() => creds.data?.credenciales.filter((c) => c.estado === "activa") ?? [], [creds.data]);
  const credId = params.get("c") ?? activas[0]?.id;
  const cred = activas.find((c) => c.id === credId);
  const [desde] = useState(() => Date.now());

  const qr = useQuery({
    queryKey: ["qr", credId],
    enabled: Boolean(cred),
    queryFn: () =>
      api<{ token: string; expira_en: string }>("/api/b/qr", {
        method: "POST",
        json: { credencialId: credId, dispositivoId: idDispositivo() },
      }),
    // Rotación automática: se pide uno nuevo antes de que expire.
    refetchInterval: (q) => (q.state.data ? Math.max(1000, new Date(q.state.data.expira_en).getTime() - Date.now() - 4000) : false),
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    retry: (n, e) => !(e instanceof ErrorApi && e.status < 500) && n < 2,
  });

  // Cuando el comercio crea el cobro, saltamos a "Pago pendiente".
  useQuery({
    queryKey: ["pendiente", desde],
    enabled: Boolean(cred),
    queryFn: async () => {
      const r = await api<{ transaccion: { id: string } | null }>(`/api/b/pendiente?desde=${desde}`);
      if (r.transaccion) router.push(`/b/pago/${r.transaccion.id}`);
      return r.transaccion;
    },
    refetchInterval: 2000,
  });

  // Mantener la pantalla encendida mientras se muestra el QR.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  if (creds.isLoading) return <Cargando />;
  if (!cred)
    return (
      <>
        <Encabezado titulo="Mi QR" />
        <Vacio titulo="No tienes una credencial vigente">
          <Button asChild className="mt-4">
            <Link href="/b/onboarding">Verificar mi descuento</Link>
          </Button>
        </Vacio>
      </>
    );

  return (
    <>
      <Encabezado titulo="Mi QR" subtitulo={`${cred.emisor_corto} · muéstralo al pagar`} atras="/b" />
      <Contenido className="flex flex-col items-center">
        {qr.isError ? (
          <ErrorEstado
            mensaje={qr.error instanceof ErrorApi ? qr.error.message : "No pudimos generar tu código."}
            reintentar={() => qr.refetch()}
          />
        ) : !qr.data ? (
          <Cargando texto="Generando tu código…" />
        ) : (
          <QrConContador key={qr.data.token} token={qr.data.token} expira={qr.data.expira_en} actualizando={qr.isFetching} />
        )}
        <p className="flex items-center gap-2 text-center text-texto-suave">
          <Sun className="size-5 shrink-0" aria-hidden /> Sube el brillo de tu pantalla para escanear más rápido.
        </p>
        <p className="text-center text-sm text-texto-suave">
          Tu código no muestra tu nombre ni tu edad. Cambia cada {TTL} segundos y solo se puede usar una vez.
        </p>
      </Contenido>
    </>
  );
}

function QrConContador({ token, expira, actualizando }: { token: string; expira: string; actualizando: boolean }) {
  const fin = new Date(expira).getTime();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const restante = Math.max(0, Math.ceil((fin - ahora) / 1000));
  const fraccion = Math.min(1, restante / TTL);
  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex w-full flex-col items-center gap-4">
      {/* Fondo blanco SIEMPRE (incluso en modo oscuro) para que el escáner lo lea. */}
      <div className="w-full max-w-[22rem] rounded-2xl bg-white p-5 shadow-lg" role="img" aria-label="Código QR de tu credencial de descuento">
        <QRCodeSVG value={token} level="M" marginSize={2} className="h-auto w-full" bgColor="#FFFFFF" fgColor="#000000" />
      </div>
      <div className="flex items-center gap-3" aria-live="polite">
        <svg viewBox="0 0 50 50" className="size-12 -rotate-90" aria-hidden>
          <circle cx="25" cy="25" r={R} fill="none" stroke="var(--borde)" strokeWidth="5" />
          <circle
            cx="25"
            cy="25"
            r={R}
            fill="none"
            stroke={restante <= 10 ? "var(--aviso)" : "var(--primario)"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraccion)}
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>
        <p className="text-lg font-semibold">
          {restante > 0 ? (
            <>
              Se renueva en <span className="tabular-nums">{restante}</span> s
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={actualizando ? "size-5 animate-spin" : "size-5"} aria-hidden /> Renovando…
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}
