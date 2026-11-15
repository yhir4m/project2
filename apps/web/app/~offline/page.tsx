import { WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

export default function SinConexion() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-aviso-fondo text-aviso">
        <WifiOff className="size-10" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">Sin conexión</h1>
      <p className="text-texto-suave">
        Para mostrar tu código o cobrar necesitas internet. Revisa tu conexión e intenta de nuevo.
      </p>
    </main>
  );
}
