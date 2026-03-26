import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
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
 *
 * AppState integration: wires React Native AppState to TanStack's focusManager
 * so that queries refetch on app resume — replaces Flutter's WidgetsBindingObserver.
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

function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
