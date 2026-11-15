"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Ayuda, Input, Label } from "@/components/ui/input";
import { supabaseNavegador } from "@/lib/supabase/client";

export default function EntrarPagina() {
  return (
    <Suspense>
      <Entrar />
    </Suspense>
  );
}

/** Inicio de sesión con enlace mágico de Supabase Auth (sin contraseña). */
function Entrar() {
  const params = useSearchParams();
  const siguiente = params.get("next") ?? "/";
  const [enviado, setEnviado] = useState<string | null>(null);
  const f = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().trim().email("Escribe un correo válido") })),
  });

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-md space-y-5 bg-fondo px-4 py-10 sm:shadow-2xl">
      <h1 className="text-3xl font-bold">Entrar</h1>
      {params.get("error") ? (
        <p role="alert" className="rounded-xl bg-error-fondo p-3 font-semibold text-error">
          El enlace no es válido o ya expiró. Pide uno nuevo.
        </p>
      ) : null}
      {enviado ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-exito-fondo p-6 text-center">
          <MailCheck className="size-12 text-exito" aria-hidden />
          <p className="text-xl font-bold">Revisa tu correo</p>
          <p>
            Enviamos un enlace a <strong>{enviado}</strong>. Ábrelo en este teléfono para entrar.
          </p>
          <Button variant="fantasma" onClick={() => setEnviado(null)}>
            Usar otro correo
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={f.handleSubmit(async ({ email }) => {
            const redirect = new URL("/auth/callback", window.location.origin);
            redirect.searchParams.set("next", siguiente);
            const { error } = await supabaseNavegador().auth.signInWithOtp({
              email,
              options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
            });
            if (error) toast.error("No pudimos enviar el enlace. Intenta en unos minutos.");
            else setEnviado(email);
          })}
        >
          <p className="text-lg text-texto-suave">
            Te enviamos un enlace para entrar, sin contraseña. Si eres estudiante, usa tu correo institucional: así te verificas
            al mismo tiempo.
          </p>
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(f.formState.errors.email)} {...f.register("email")} />
            {f.formState.errors.email ? <Ayuda error>{f.formState.errors.email.message}</Ayuda> : null}
          </div>
          <Button type="submit" cargando={f.formState.isSubmitting}>
            Enviarme el enlace
          </Button>
        </form>
      )}
      <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-primario underline">
        Volver
      </Link>
    </main>
  );
}
