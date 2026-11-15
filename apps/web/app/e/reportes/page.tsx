"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Contenido, Encabezado } from "@/components/app-shell";
import { ErrorEstado, Esqueleto, Vacio } from "@/components/estados";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { mxn } from "@/lib/utils";

interface Reporte {
  desde: string;
  hasta: string;
  filas: { dia: string; convenio: string; usos: number; descuento_centavos: number; venta_centavos: number; efectivo: number; codi: number }[];
  credenciales: { activas: number; revocadas: number; en_revision: number };
}

/** Reportes agregados (sin datos personales): usos y monto descontado por día. */
export default function Reportes() {
  const q = useQuery({ queryKey: ["e-reportes"], queryFn: () => api<Reporte>("/api/e/reportes") });
  const porDia = new Map<string, { usos: number; descuento: number }>();
  for (const f of q.data?.filas ?? []) {
    const d = porDia.get(f.dia) ?? { usos: 0, descuento: 0 };
    d.usos += f.usos;
    d.descuento += f.descuento_centavos;
    porDia.set(f.dia, d);
  }
  const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...dias.map(([, d]) => d.descuento));
  const total = dias.reduce((s, [, d]) => ({ usos: s.usos + d.usos, descuento: s.descuento + d.descuento }), { usos: 0, descuento: 0 });

  return (
    <>
      <Encabezado titulo="Reportes" subtitulo="Últimos 14 días · datos agregados" />
      <Contenido>
        {q.isLoading ? (
          <Esqueleto />
        ) : q.isError ? (
          <ErrorEstado mensaje="No pudimos cargar los reportes." reintentar={() => q.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Kpi t="Activas" v={q.data!.credenciales.activas} />
              <Kpi t="En revisión" v={q.data!.credenciales.en_revision} />
              <Kpi t="Revocadas" v={q.data!.credenciales.revocadas} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Kpi t="Usos" v={total.usos} />
              <Kpi t="Descontado" v={mxn(total.descuento)} />
            </div>
            {!dias.length ? (
              <Vacio titulo="Sin uso todavía" icono={<BarChart3 />}>Cuando se usen las credenciales verás la actividad aquí.</Vacio>
            ) : (
              <Card>
                <h2 className="mb-3 font-bold">Monto descontado por día</h2>
                <ul className="space-y-2">
                  {dias.map(([dia, d]) => (
                    <li key={dia} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm">
                      <span className="text-texto-suave">{dia.slice(5)}</span>
                      <span className="h-5 rounded bg-primario/15">
                        <span className="block h-full rounded bg-primario" style={{ width: `${(d.descuento / max) * 100}%` }} />
                      </span>
                      <span className="font-semibold tabular-nums">{mxn(d.descuento)} · {d.usos}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </Contenido>
    </>
  );
}

function Kpi({ t, v }: { t: string; v: string | number }) {
  return (
    <Card className="p-3">
      <p className="text-sm text-texto-suave">{t}</p>
      <p className="text-xl font-bold tabular-nums">{v}</p>
    </Card>
  );
}
