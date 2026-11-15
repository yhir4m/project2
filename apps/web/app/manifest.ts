import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Descuento Verificado",
    short_name: "Descuento",
    description: "Verifica tu descuento una vez y úsalo con un solo escaneo. Pago con CoDi.",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F3EB",
    theme_color: "#C5A358",
    categories: ["finance", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pagar", url: "/b/pagar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cobrar", url: "/c", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
