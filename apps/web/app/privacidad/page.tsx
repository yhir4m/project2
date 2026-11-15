import Link from "next/link";

export const metadata = { title: "Aviso de privacidad" };

/** Aviso de privacidad simplificado (LFPDPPP). Texto base para la demo: debe revisarlo un área legal antes de producción. */
export default function Privacidad() {
  return (
    <main className="pt-safe pb-safe mx-auto max-w-md space-y-4 bg-fondo px-4 py-8 text-lg">
      <h1 className="text-2xl font-bold">Aviso de privacidad simplificado</h1>
      <p>
        <strong>Responsable:</strong> el equipo de “Descuento Verificado” (proyecto de hackatón) es responsable del tratamiento de tus
        datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
      </p>
      <h2 className="text-xl font-bold">¿Para qué usamos tus datos?</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Confirmar que eres beneficiario de un convenio (estudiante, adulto mayor u otro).</li>
        <li>Emitir tu credencial digital y aplicar tu descuento.</li>
        <li>Enviarte el cobro CoDi a tu celular, si nos lo das, y entregarte tu ticket.</li>
      </ul>
      <h2 className="text-xl font-bold">¿Qué datos?</h2>
      <p>
        Nombre (para verificar tu documento), correo institucional o foto del documento, y opcionalmente tu celular. La foto se borra al
        terminar la verificación; del proceso solo guardamos el resultado, el método y la fecha. El correo institucional no se guarda.
      </p>
      <h2 className="text-xl font-bold">¿Con quién se comparten?</h2>
      <p>
        El negocio solo ve que tu descuento es válido y el convenio aplicado; nunca tu nombre, edad, CURP ni celular. Tu institución ve
        reportes agregados sin datos personales. El pago se procesa con Pey (CoDi) y la revisión del documento con un proveedor de IA (xAI).
      </p>
      <h2 className="text-xl font-bold">Tus derechos ARCO</h2>
      <p>Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos y revocar tu consentimiento escribiendo al equipo responsable.</p>
      <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-primario underline">
        Volver
      </Link>
    </main>
  );
}
