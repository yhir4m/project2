import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { TEXTO_ESTADO } from "@/components/pago/estado-cobro";
import { Badge } from "@/components/ui/badge";
import type { VistaTx } from "@/hooks/use-transaccion";
import { fechaHora, mxn } from "@/lib/utils";

export function ListaTransacciones({ txs, href }: { txs: VistaTx[]; href: (t: VistaTx) => string }) {
  return (
    <ul className="overflow-hidden rounded-xl border border-borde bg-superficie">
      {txs.map((t) => (
        <li key={t.id} className="border-b border-borde last:border-0">
          <Link href={href(t)} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-fondo">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{t.comercio}</p>
              <p className="truncate text-sm text-texto-suave">
                {fechaHora(t.pagada_en ?? t.created_at)} · {t.metodo === "codi" ? "CoDi" : "Efectivo"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{mxn(t.monto_final_centavos)}</p>
              {t.estado === "pagada" ? (
                t.descuento_centavos > 0 ? <p className="text-sm font-semibold text-exito">−{mxn(t.descuento_centavos)}</p> : null
              ) : (
                <Badge tono={["pendiente", "incierta", "creando"].includes(t.estado) ? "aviso" : "error"}>{TEXTO_ESTADO[t.estado]}</Badge>
              )}
            </div>
            <ChevronRight className="size-5 text-texto-suave" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
