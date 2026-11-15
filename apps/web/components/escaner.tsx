"use client";

import { Camera, CameraOff, ClipboardPaste } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DetectorNativo = { detect: (v: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
type ClaseDetector = (new (o: { formats: string[] }) => DetectorNativo) & { getSupportedFormats?: () => Promise<string[]> };

/** Detector nativo del navegador si existe y soporta QR (Chrome/Android). En iOS Safari no existe → zxing. */
async function detectorNativo(): Promise<DetectorNativo | null> {
  const BD = (globalThis as unknown as { BarcodeDetector?: ClaseDetector }).BarcodeDetector;
  if (!BD) return null;
  try {
    const formatos = (await BD.getSupportedFormats?.()) ?? ["qr_code"];
    return formatos.includes("qr_code") ? new BD({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

function mensajeError(e: unknown): string {
  const n = e instanceof Error ? e.name : "";
  if (n === "NotAllowedError" || n === "SecurityError") return "Permite el acceso a la cámara (ícono junto a la dirección) y recarga.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No encontramos una cámara en este dispositivo.";
  if (n === "NotReadableError") return "La cámara está ocupada por otra app. Ciérrala e intenta de nuevo.";
  return "No pudimos abrir la cámara.";
}

/**
 * Escáner de QR a pantalla completa.
 * - Cada arranque es dueño de su propio stream (seguro con el doble montaje de React en desarrollo).
 * - Motor: BarcodeDetector nativo si soporta QR; si no, @zxing/browser sobre el mismo stream.
 * - La cámara en vivo requiere HTTPS (o localhost); si no, queda el botón "Tomar foto del código".
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
  const [listo, setListo] = useState(false);
  const [manual, setManual] = useState("");
  const ultimo = useRef<{ t: string; at: number } | null>(null);
  const onLeerRef = useRef(onLeer);
  onLeerRef.current = onLeer;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  useEffect(() => {
    const elVideo = video.current;
    let activo = true;
    let stream: MediaStream | null = null;
    let detenerZxing: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const entregar = (t: string) => {
      if (!activo || pausadoRef.current || !t) return;
      const ahora = Date.now();
      if (ultimo.current && ultimo.current.t === t && ahora - ultimo.current.at < 4000) return;
      ultimo.current = { t, at: ahora };
      navigator.vibrate?.(60);
      onLeerRef.current(t);
    };

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          window.isSecureContext
            ? "Este navegador no permite usar la cámara en vivo."
            : "La cámara en vivo solo funciona si abres la app con https://.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        if (activo) setError(mensajeError(e));
        return;
      }
      const v = elVideo;
      if (!activo || !v) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      try {
        await v.play();
      } catch {
        /* iOS puede requerir gesto; el video muted+playsinline normalmente arranca */
      }
      if (!activo) return;
      setListo(true);

      const nativo = await detectorNativo();
      if (nativo) {
        const ciclo = async () => {
          if (!activo) return;
          if (v.readyState >= 2) {
            try {
              const [c] = await nativo.detect(v);
              if (c?.rawValue) entregar(c.rawValue);
            } catch {
              /* frame no listo */
            }
          }
          timer = setTimeout(ciclo, 180);
        };
        void ciclo();
        return;
      }

      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (!activo) return;
      const lector = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 1500 });
      try {
        const controles = await lector.decodeFromStream(stream, v, (r) => r && entregar(r.getText()));
        if (!activo) controles.stop();
        else detenerZxing = () => controles.stop();
      } catch (e) {
        if (activo) setError(mensajeError(e));
      }
    }

    // Arranque en el siguiente tick: si React desmonta de inmediato (StrictMode), nunca se pide la cámara.
    const arranque = setTimeout(() => void iniciar(), 0);
    return () => {
      activo = false;
      clearTimeout(arranque);
      if (timer) clearTimeout(timer);
      detenerZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
      if (elVideo && elVideo.srcObject === stream) elVideo.srcObject = null;
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
            {!pausado && !error && listo ? <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-white/80" /> : null}
          </div>
        </div>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <CameraOff className="size-12" aria-hidden />
            <p className="text-lg font-semibold">{error}</p>
            <p className="text-base">Usa el botón “Tomar foto del código”.</p>
          </div>
        ) : null}
        {!listo && !error ? (
          <p className="absolute inset-0 grid place-items-center text-base font-semibold text-white">Abriendo cámara…</p>
        ) : null}
        <p className="absolute inset-x-0 bottom-3 text-center text-base font-semibold text-white drop-shadow">
          {indicacion}
        </p>
      </div>
      <FotoDelCodigo onLeer={onLeer} destacado={Boolean(error)} />
      {permitirPegar ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onLeer(manual.trim());
            setManual("");
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Pega el código QR aquí" aria-label="Pegar código" className="min-h-12 text-base" />
          <Button type="submit" ancho="auto" size="icono" variant="secundario" aria-label="Validar código pegado">
            <ClipboardPaste />
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Respaldo sin cámara en vivo: abre la cámara nativa del teléfono (input file con `capture`),
 * que funciona aunque el navegador bloquee getUserMedia (http, navegadores dentro de otras apps),
 * y decodifica el QR de la foto.
 */
function FotoDelCodigo({ onLeer, destacado }: { onLeer: (texto: string) => void; destacado: boolean }) {
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function leerFoto(archivo: File) {
    setLeyendo(true);
    setAviso(null);
    const url = URL.createObjectURL(archivo);
    try {
      let texto: string | null = null;
      const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (i: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (BD) {
        try {
          const [c] = await new BD({ formats: ["qr_code"] }).detect(await createImageBitmap(archivo));
          texto = c?.rawValue ?? null;
        } catch {}
      }
      if (!texto) {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        texto = (await new BrowserQRCodeReader().decodeFromImageUrl(url)).getText();
      }
      navigator.vibrate?.(60);
      onLeer(texto);
    } catch {
      setAviso("No encontramos un código en la foto. Acércate y que salga completo y enfocado.");
    } finally {
      URL.revokeObjectURL(url);
      setLeyendo(false);
    }
  }

  return (
    <div className="space-y-1">
      <label
        className={`flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-lg font-semibold ${
          destacado ? "bg-primario text-primario-texto" : "border-2 border-borde bg-superficie text-texto"
        } ${leyendo ? "opacity-60" : ""}`}
      >
        <Camera className="size-6" aria-hidden />
        {leyendo ? "Leyendo foto…" : "Tomar foto del código"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={leyendo}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void leerFoto(f);
          }}
        />
      </label>
      {aviso ? <p role="alert" className="text-center text-sm font-semibold text-error">{aviso}</p> : null}
    </div>
  );
}
