"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Plus, Store } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BotonSalir, Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ayuda, Input, Label } from "@/components/ui/input";
import { useYo } from "@/hooks/use-yo";
import { api, ErrorApi } from "@/lib/api";

interface ConvenioVista {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_beneficiario: string;
  activo: boolean;
  regla_texto: string;
  comercios: { id: string; nombre: string }[];
}

export default function Convenios() {
  const yo = useYo();
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState(false);
  const q = useQuery({ queryKey: ["e-convenios"], queryFn: () => api<{ convenios: ConvenioVista[] }>("/api/e/convenios") });
  const alternar = useMutation({
    mutationFn: (c: ConvenioVista) => api(`/api/e/convenios/${c.id}`, { method: "PATCH", json: { activo: !c.activo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["e-convenios"] }),
    onError: (e) => toast.error(e instanceof ErrorApi ? e.message : "No se pudo actualizar."),
  });

  return (
    <>
      <Encabezado titulo="Convenios" subtitulo={yo.data?.emisor?.nombre} accion={<BotonSalir />} />
      <Contenido>
        {nuevo ? (
          <NuevoConvenio tipos={yo.data?.emisor?.tipos_beneficiario ?? []} onListo={() => setNuevo(false)} />
        ) : (
          <Button onClick={() => setNuevo(true)}><Plus /> Nuevo convenio</Button>
        )}
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar los convenios." reintentar={() => q.refetch()} />
        ) : !q.data!.convenios.length ? (
          <Vacio titulo="Sin convenios" icono={<Handshake />}>Da de alta el primero.</Vacio>
        ) : (
          q.data!.convenios.map((c) => (
            <Card key={c.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{c.nombre}</p>
                  <p className="text-texto-suave">{c.regla_texto}</p>
                </div>
                <Badge tono={c.activo ? "exito" : "neutro"}>{c.activo ? "Activo" : "Pausado"}</Badge>
              </div>
              {c.comercios.length ? (
                <ul className="flex flex-wrap gap-1">
                  {c.comercios.map((x) => (
                    <li key={x.id}><Badge><Store className="size-3.5" aria-hidden /> {x.nombre}</Badge></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-aviso">Aún no hay comercios adheridos.</p>
              )}
              <Button variant="secundario" size="md" cargando={alternar.isPending && alternar.variables?.id === c.id} onClick={() => alternar.mutate(c)}>
                {c.activo ? "Pausar" : "Activar"}
              </Button>
            </Card>
          ))
        )}
      </Contenido>
    </>
  );
}

const FormSchema = z.object({
  nombre: z.string().trim().min(3, "Mínimo 3 letras").max(80),
  tipo_beneficiario: z.string().min(1),
  tipo: z.enum(["porcentaje", "monto_fijo"]),
  valor: z.coerce.number().positive("Debe ser mayor a 0"),
  tope: z.coerce.number().min(0).optional(),
  usos: z.coerce.number().int().min(0).optional(),
});

function NuevoConvenio({ tipos, onListo }: { tipos: string[]; onListo: () => void }) {
  const qc = useQueryClient();
  const f = useForm<z.input<typeof FormSchema>, unknown, z.output<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { tipo: "porcentaje", tipo_beneficiario: tipos[0] ?? "", nombre: "", valor: 10 },
  });
  const tipo = f.watch("tipo");
  return (
    <Card>
      <form
        noValidate
        className="space-y-3"
        onSubmit={f.handleSubmit(async (v) => {
          const regla = {
            tipo: v.tipo,
            valor: v.tipo === "porcentaje" ? v.valor : Math.round(v.valor * 100),
            ...(v.tope ? { tope_centavos: Math.round(v.tope * 100) } : {}),
            ...(v.usos ? { usos_por_dia: v.usos } : {}),
          };
          try {
            await api("/api/e/convenios", { method: "POST", json: { nombre: v.nombre, tipo_beneficiario: v.tipo_beneficiario, regla } });
            toast.success("Convenio creado");
            await qc.invalidateQueries({ queryKey: ["e-convenios"] });
            onListo();
          } catch (e) {
            toast.error(e instanceof ErrorApi ? e.message : "No se pudo crear.");
          }
        })}
      >
        <div>
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...f.register("nombre")} aria-invalid={Boolean(f.formState.errors.nombre)} />
          {f.formState.errors.nombre ? <Ayuda error>{f.formState.errors.nombre.message}</Ayuda> : null}
        </div>
        <div>
          <Label htmlFor="tipo">Tipo de descuento</Label>
          <select id="tipo" {...f.register("tipo")} className="min-h-14 w-full rounded-xl border-2 border-borde bg-superficie px-3 text-lg">
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto_fijo">Monto fijo ($)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="valor">{tipo === "porcentaje" ? "Porcentaje" : "Monto ($)"}</Label>
            <Input id="valor" inputMode="decimal" {...f.register("valor")} aria-invalid={Boolean(f.formState.errors.valor)} />
          </div>
          <div>
            <Label htmlFor="tope">Tope ($)</Label>
            <Input id="tope" inputMode="decimal" placeholder="Sin tope" {...f.register("tope")} />
          </div>
        </div>
        <div>
          <Label htmlFor="usos">Usos por día</Label>
          <Input id="usos" inputMode="numeric" placeholder="Sin límite" {...f.register("usos")} />
        </div>
        <Button type="submit" cargando={f.formState.isSubmitting}>Guardar convenio</Button>
        <Button type="button" variant="fantasma" onClick={onListo}>Cancelar</Button>
      </form>
    </Card>
  );
}
