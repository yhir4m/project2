import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

// Atkinson Hyperlegible: diseñada para baja visión (adultos mayores).
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Descuento Verificado", template: "%s · Descuento Verificado" },
  description: "Verifica tu descuento una vez y úsalo con un solo escaneo. Pago con CoDi.",
  applicationName: "Descuento Verificado",
  appleWebApp: { capable: true, title: "Descuento", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F4" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1116" },
  ],
};

// Aplica "letra grande" antes de pintar para evitar parpadeo.
const preferencias = `try{var l=localStorage.getItem("cdv_letra");if(l)document.documentElement.dataset.letra=l}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={atkinson.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferencias }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
