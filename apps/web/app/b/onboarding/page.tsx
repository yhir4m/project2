"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, Clock, FileText, Mail, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Contenido, Encabezado } from "@/components/app-shell";
import { Cargando, ErrorEstado } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ayuda, Input, Label } from "@/components/ui/input";
import { useActualizarYo, useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";

interface EmisorOpcion {
  id: string;
  nombre: string;
  nombre_corto: string;
  metodos: ("correo_institucional" | "documento_ia")[];
  dominio: string | null;
}

type Paso =
  | { p: "consentimiento" }
  | { p: "institucion" }
  | { p: "metodo"; emisor: EmisorOpcion }
  | { p: "correo"; emisor: EmisorOpcion }
  | { p: "documento"; emisor: EmisorOpcion }
  | { p: "resultado"; estado: "aprobada" | "rechazada" | "revision_manual"; emisor: EmisorOpcion };

export default function Onboarding() {
  const yo = useYo();
  const [paso, setPaso] = useState<Paso | null>(null);
  const emisores = useQuery({
    queryKey: ["emisores"],
    queryFn: () => api<{ emisores: EmisorOpcion[] }>("/api/emisores").then((r) => r.emisores),
  });
  if (!yo.data || emisores.isLoading) return <Cargando />;
  if (emisores.isError) return <ErrorEstado mensaje="No pudimos cargar las instituciones." reintentar={() => emisores.refetch()} />;
  const actual: Paso = paso ?? (yo.data.consentimiento ? { p: "institucion" } : { p: "consentimiento" });

  return (
    <>
      <Encabezado titulo="Verificar mi descuento" subtitulo="Solo una vez por periodo" atras="/b" />
      <Contenido>
        <AnimatePresence mode="wait">
          <motion.div key={actual.p} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-4">
            {actual.p === "consentimiento" && <Consentimiento onListo={() => setPaso({ p: "institucion" })} />}
            {actual.p === "institucion" && (
              <>
                <h2 className="text-xl font-bold">¿De qué institución es tu descuento?</h2>
                {emisores.data!.map((e) => (
                  <button key={e.id} onClick={() => setPaso({ p: "metodo", emisor: e })} className="w-full text-left">
                    <Card className="min-h-16 active:bg-fondo">
                      <p className="text-lg font-bold">{e.nombre_corto}</p>
                      <p className="text-texto-suave">{e.nombre}</p>
                    </Card>
                  </button>
                ))}
              </>
            )}
            {actual.p === "metodo" && (
              <>
                <h2 className="text-xl font-bold">¿Cómo quieres verificarte?</h2>
                {actual.emisor.metodos.includes("correo_institucional") && (
                  <Opcion
                    icono={<Mail />}
                    titulo="Con mi correo institucional"
                    texto={`Te enviamos un código a tu correo @${actual.emisor.dominio}. Es lo más rápido.`}
                    onClick={() => setPaso({ p: "correo", emisor: actual.emisor })}
                  />
                )}
                <Opcion
                  icono={<FileText />}
                  titulo="Con una foto de mi documento"
                  texto={
                    actual.emisor.id === "inapam"
                      ? "Tu credencial INAPAM vigente."
                      : "Tu constancia de estudios o credencial vigente."
                  }
                  onClick={() => setPaso({ p: "documento", emisor: actual.emisor })}
                />
              </>
            )}
            {actual.p === "correo" && <PasoCorreo emisor={actual.emisor} onResultado={(estado) => setPaso({ p: "resultado", estado, emisor: actual.emisor })} />}
            {actual.p === "documento" && (
              <PasoDocumento emisor={actual.emisor} onResultado={(estado) => setPaso({ p: "resultado", estado, emisor: actual.emisor })} />
            )}
            {actual.p === "resultado" && <Resultado estado={actual.estado} onReintentar={() => setPaso({ p: "metodo", emisor: actual.emisor })} />}
          </motion.div>
        </AnimatePresence>
      </Contenido>
    </>
  );
}

function Opcion({ icono, titulo, texto, onClick }: { icono: React.ReactNode; titulo: string; texto: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className="flex min-h-16 items-start gap-3 active:bg-fondo">
        <span className="mt-0.5 text-primario [&_svg]:size-7">{icono}</span>
        <span>
          <span className="block text-lg font-bold">{titulo}</span>
          <span className="block text-texto-suave">{texto}</span>
        </span>
      </Card>
    </button>
  );
}

function Consentimiento({ onListo }: { onListo: () => void }) {
  const act = useActualizarYo();
  const [acepto, setAcepto] = useState(false);
  return (
    <>
      <div className="grid size-16 place-items-center rounded-full bg-primario/10 text-primario">
        <ShieldCheck className="size-8" aria-hidden />
      </div>
      <h2 className="text-2xl font-bold">Tus datos, protegidos</h2>
      <ul className="list-disc space-y-2 pl-5 text-lg">
        <li>Usamos tus datos solo para confirmar tu descuento.</li>
        <li>La foto de tu documento se borra al terminar la revisión.</li>
        <li>Tu código QR no muestra tu nombre, edad ni CURP.</li>
        <li>El negocio solo ve “descuento válido”.</li>
      </ul>
      <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-borde bg-superficie p-4">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1 size-6 accent-[var(--primario)]" />
        <span>
          Leí y acepto el{" "}
          <Link href="/privacidad" className="font-semibold text-primario underline">
            aviso de privacidad
          </Link>
          .
        </span>
      </label>
      <Button disabled={!acepto} cargando={act.isPending} onClick={() => act.mutate({ consentimiento: true }, { onSuccess: onListo })}>
        Continuar
      </Button>
    </>
  );
}

function PasoCorreo({ emisor, onResultado }: { emisor: EmisorOpcion; onResultado: (e: "aprobada") => void }) {
  const qc = useQueryClient();
  const yo = useYo();
  const [enviando, setEnviando] = useState(false);
  const [noInstitucional, setNoInstitucional] = useState(false);
  const correo = yo.data?.email ?? null;

  if (noInstitucional || (correo && emisor.dominio && !correo.toLowerCase().endsWith("@" + emisor.dominio)))
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Entra con tu correo de {emisor.nombre_corto}</h2>
        <p className="text-lg text-texto-suave">
          Tu sesión actual es {correo ? <strong>{correo}</strong> : "de otra cuenta"}. Para verificarte con este método, entra con tu
          correo <strong>@{emisor.dominio}</strong>: te enviaremos un enlace y quedarás verificado.
        </p>
        <Button
          onClick={async () => {
            await fetch("/api/sesion/salir", { method: "POST" });
            window.location.href = "/entrar?next=/b/onboarding";
          }}
        >
          <Mail /> Entrar con mi correo institucional
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Verificar con tu correo</h2>
      <p className="text-lg">
        Entraste con <strong>{correo}</strong>. Como es un correo de {emisor.nombre_corto}, podemos emitir tu credencial ahora.
      </p>
      <Button
        cargando={enviando}
        onClick={async () => {
          setEnviando(true);
          try {
            await api("/api/b/verificacion/correo", { method: "POST", json: { emisorId: emisor.id } });
            await qc.invalidateQueries({ queryKey: ["credenciales"] });
            onResultado("aprobada");
          } catch (e) {
            if (e instanceof ErrorApi && e.codigo === "correo_no_institucional") setNoInstitucional(true);
            else toast.error(e instanceof ErrorApi ? e.message : "No se pudo verificar.");
          } finally {
            setEnviando(false);
          }
        }}
      >
        Verificarme
      </Button>
    </div>
  );
}

function PasoDocumento({ emisor, onResultado }: { emisor: EmisorOpcion; onResultado: (e: "aprobada" | "rechazada" | "revision_manual") => void }) {
  const qc = useQueryClient();
  const yo = useYo();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const f = useForm<{ nombre: string }>({
    resolver: zodResolver(z.object({ nombre: z.string().trim().min(5, "Escribe tu nombre completo").max(100) })),
    defaultValues: { nombre: "" },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={f.handleSubmit(async ({ nombre }) => {
        if (!archivo) return toast.error("Toma o sube una foto del documento.");
        setEnviando(true);
        try {
          const fd = new FormData();
          fd.set("emisorId", emisor.id);
          fd.set("nombre", nombre);
          fd.set("archivo", archivo);
          const r = await api<{ estado: "aprobada" | "rechazada" | "revision_manual" }>("/api/b/verificacion/documento", { method: "POST", body: fd });
          await qc.invalidateQueries({ queryKey: ["credenciales"] });
          onResultado(r.estado);
        } catch (e) {
          toast.error(e instanceof ErrorApi ? e.message : "No se pudo revisar el documento.");
        } finally {
          setEnviando(false);
        }
      })}
    >
      <h2 className="text-xl font-bold">Foto de tu documento</h2>
      <div>
        <Label htmlFor="nombre">Tu nombre completo (como aparece en el documento)</Label>
        <Input id="nombre" autoComplete="name" aria-invalid={Boolean(f.formState.errors.nombre)} placeholder={yo.data?.nombre ?? ""} {...f.register("nombre")} />
        {f.formState.errors.nombre ? <Ayuda error>{f.formState.errors.nombre.message}</Ayuda> : null}
      </div>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primario/50 bg-primario/5 p-4 text-center text-primario">
        <Camera className="size-10" aria-hidden />
        <span className="text-lg font-bold">{archivo ? archivo.name : "Tomar o subir foto"}</span>
        <span className="text-sm text-texto-suave">JPG o PNG. Que se lea bien y sin reflejos.</span>
        <input type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
      </label>
      <p className="text-sm text-texto-suave">Una IA revisa tu documento. La foto se borra al terminar.</p>
      <Button type="submit" cargando={enviando}>{enviando ? "Revisando…" : "Enviar a revisión"}</Button>
    </form>
  );
}

function Resultado({ estado, onReintentar }: { estado: "aprobada" | "rechazada" | "revision_manual"; onReintentar: () => void }) {
  const cfg = {
    aprobada: { Icono: CheckCircle2, color: "text-exito bg-exito-fondo", titulo: "¡Listo! Ya tienes tu credencial", texto: "Úsala con tu código QR en los negocios con convenio." },
    revision_manual: { Icono: Clock, color: "text-aviso bg-aviso-fondo", titulo: "Tu documento está en revisión", texto: "Una persona de tu institución lo revisará. Te avisaremos aquí." },
    rechazada: { Icono: XCircle, color: "text-error bg-error-fondo", titulo: "No pudimos aprobarlo", texto: "El documento no es vigente o no es del tipo correcto. Intenta con otro." },
  }[estado];
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className={`grid size-20 place-items-center rounded-full ${cfg.color}`}>
        <cfg.Icono className="size-10" aria-hidden />
      </div>
      <h2 className="text-2xl font-bold">{cfg.titulo}</h2>
      <p className="text-lg text-texto-suave">{cfg.texto}</p>
      {estado === "aprobada" ? (
        <Button asChild size="xl"><Link href="/b/qr">Ver mi QR</Link></Button>
      ) : estado === "rechazada" ? (
        <Button onClick={onReintentar}>Intentar de nuevo</Button>
      ) : (
        <Button asChild variant="secundario"><Link href="/b">Volver a mi cartera</Link></Button>
      )}
    </div>
  );
}
