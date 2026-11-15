import {
  BarChart3,
  Bell,
  CreditCard,
  FileCheck2,
  Handshake,
  History,
  QrCode,
  Receipt,
  ScanLine,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";

const ICONOS = {
  cartera: Wallet,
  qr: QrCode,
  historial: History,
  perfil: User,
  escanear: ScanLine,
  cobrar: CreditCard,
  corte: Receipt,
  convenios: Handshake,
  revision: FileCheck2,
  credenciales: ShieldCheck,
  reportes: BarChart3,
  notificaciones: Bell,
} as const;
export type NombreIcono = keyof typeof ICONOS;

/** Los íconos se resuelven por nombre para poder pasar la nav desde Server Components. */
export function NavIcono({ nombre, className }: { nombre: NombreIcono; className?: string }) {
  const C = ICONOS[nombre];
  return <C className={className} aria-hidden />;
}
