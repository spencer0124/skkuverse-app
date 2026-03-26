import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * TanStack Query provider with shared defaults.
 *
 * staleTime: 30s — a compromise between Flutter's "re-fetch on every visit"
 * and aggressive caching. Fast tab switches reuse cache; 30s+ triggers refetch.
 * Individual queries can override via queryOptions.
 *
 * gcTime: 5 min — garbage-collect inactive queries after 5 minutes.
 * retry: 1 — one retry (network layer already has axios-retry for transient errors).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      retryDelay: 1_000,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
