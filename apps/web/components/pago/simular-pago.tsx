"use client";

import { Landmark } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ErrorApi } from "@/lib/api";

/** Solo con Pey simulado: imita la autorización en la app bancaria (dispara un webhook firmado). */
export function SimularPago({ transaccionId, texto = "Simular autorización en mi banco" }: { transaccionId: string; texto?: string }) {
  const [cargando, setCargando] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border-2 border-dashed border-aviso/50 p-3">
      <p className="text-sm font-semibold text-aviso">Demo sin Pey real</p>
      <Button
        variant="secundario"
        cargando={cargando}
        onClick={async () => {
          setCargando(true);
          try {
            await api("/api/demo/simular-pago", { method: "POST", json: { transaccionId } });
            toast.success("Autorizado. Esperando confirmación…");
          } catch (e) {
            toast.error(e instanceof ErrorApi ? e.message : "No se pudo simular.");
          } finally {
            setCargando(false);
          }
        }}
      >
        <Landmark /> {texto}
      </Button>
    </div>
  );
}
