import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single QueryClient.
 *
 * Extracted from QueryProvider so non-React callers can reach it. The reason
 * was the FCM background message handler, which is registered at module scope
 * in `index.ts`, runs outside the React tree, and used to invalidate the event
 * map's queries on a silent `eventmap-refresh` push — it has no provider to
 * read from. That push and its handler are gone with the snapshot tier, so
 * nothing headless invalidates today; the export stays because the next such
 * caller would need exactly this and would otherwise re-derive it wrongly.
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
