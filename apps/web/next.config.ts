import withSerwistInit from "@serwist/next";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // En desarrollo el SW estorba (HMR); se prueba con `pnpm build && pnpm start`.
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Raíz del monorepo (evita que Next tome lockfiles fuera del proyecto).
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  transpilePackages: ["@cdv/core", "@cdv/db", "@cdv/pey", "@cdv/ui"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // La cámara solo para este origen (escáner del comercio).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default withSerwist(nextConfig);
