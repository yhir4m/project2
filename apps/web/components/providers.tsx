"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ style: { fontSize: "var(--fs-base)", padding: "16px" } }}
        offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      />
    </QueryClientProvider>
  );
}
