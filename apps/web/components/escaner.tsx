"use client";

import { CameraOff, ClipboardPaste } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detener = () => void;

/**
 * Escáner de QR a pantalla completa.
 * Motor principal: @zxing/browser. Respaldo: BarcodeDetector nativo (si existe).
 * Requiere HTTPS (o localhost) para acceder a la cámara.
 */
export function Escaner({
  onLeer,
  pausado,
  permitirPegar,
  indicacion = "Apunta al código QR",
}: {
  onLeer: (texto: string) => void;
  pausado: boolean;
  permitirPegar?: boolean;
  indicacion?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const ultimo = useRef<{ t: string; at: number } | null>(null);
  const onLeerRef = useRef(onLeer);
  onLeerRef.current = onLeer;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  useEffect(() => {
    let detener: Detener | null = null;
    let cancelado = false;
    const entregar = (t: string) => {
      if (pausadoRef.current) return;
      const ahora = Date.now();
      if (ultimo.current && ultimo.current.t === t && ahora - ultimo.current.at < 4000) return;
      ultimo.current = { t, at: ahora };
      navigator.vibrate?.(60);
      onLeerRef.current(t);
    };

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Usa HTTPS o un navegador actualizado.");
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const lector = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
        const controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false },
          video.current!,
          (r) => r && entregar(r.getText()),
        );
        if (cancelado) controles.stop();
        else detener = () => controles.stop();
      } catch (e) {
        // Respaldo: BarcodeDetector nativo.
        const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        if (!BD) {
          setError(e instanceof Error && e.name === "NotAllowedError" ? "Permite el acceso a la cámara para escanear." : "No pudimos abrir la cámara.");
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (cancelado) return stream.getTracks().forEach((t) => t.stop());
          video.current!.srcObject = stream;
          await video.current!.play();
          const det = new BD({ formats: ["qr_code"] });
          let vivo = true;
          const ciclo = async () => {
            if (!vivo) return;
            try {
              const [c] = await det.detect(video.current!);
              if (c?.rawValue) entregar(c.rawValue);
            } catch {}
            setTimeout(ciclo, 200);
          };
          void ciclo();
          detener = () => {
            vivo = false;
            stream.getTracks().forEach((t) => t.stop());
          };
        } catch {
          setError("Permite el acceso a la cámara para escanear.");
        }
      }
    }
    void iniciar();
    return () => {
      cancelado = true;
      detener?.();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="absolute inset-0 size-full object-cover" muted playsInline aria-label="Vista de la cámara" />
        {/* Overlay con marco de enfoque */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <div className="relative aspect-square w-[70%] rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl"].map((c) => (
              <span key={c} className={`absolute size-12 border-white ${c}`} />
            ))}
            {!pausado && !error ? <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-white/80" /> : null}
          </div>
        </div>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <CameraOff className="size-12" aria-hidden />
            <p className="text-lg font-semibold">{error}</p>
          </div>
        ) : null}
        <p className="absolute inset-x-0 bottom-3 text-center text-base font-semibold text-white drop-shadow">
          {indicacion}
        </p>
      </div>
      {permitirPegar ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onLeer(manual.trim());
            setManual("");
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Demo: pega el código" aria-label="Pegar código (demo)" className="min-h-12 text-base" />
          <Button type="submit" ancho="auto" size="icono" variant="secundario" aria-label="Validar código pegado">
            <ClipboardPaste />
          </Button>
        </form>
      ) : null}
    </div>
  );
}
