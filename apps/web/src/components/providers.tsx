"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

/**
 * App-wide client providers: React Query (server/async state), nuqs (URL
 * state), and toast notifications. See ARCHITECTURE.md §6.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // Local-first: data comes from Dexie, so don't refetch on focus.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <NuqsAdapter>{children}</NuqsAdapter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
