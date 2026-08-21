import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single QueryClient.
 *
 * Extracted from QueryProvider so non-React callers can reach it. The FCM
 * background message handler is registered at module scope in `index.ts`, runs
 * outside the React tree, and needs to invalidate the event-map manifest when a
 * silent `eventmap-refresh` push arrives — it has no provider to read from.
 *
 * Keeping the definition in a plain .ts (rather than exporting it from the
 * .tsx provider) also keeps React and react-native's AppState off the headless
 * import path.
 *
 * staleTime: 30s — a compromise between Flutter's "re-fetch on every visit" and
 * aggressive caching. Fast tab switches reuse cache; 30s+ triggers refetch.
 * Individual queries override via queryOptions.
 *
 * gcTime: 5 min — garbage-collect inactive queries after 5 minutes.
 * retry: 1 — one retry (the network layer already has axios-retry for
 * transient errors).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      retryDelay: 1_000,
    },
  },
});
