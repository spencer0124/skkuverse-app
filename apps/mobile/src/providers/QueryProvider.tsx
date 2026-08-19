import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '@/lib/query-client';

/**
 * TanStack Query provider.
 *
 * The client itself lives in `@/lib/query-client` so background handlers, which
 * run outside the React tree, can share this exact instance. See that file for
 * the defaults and why they were chosen.
 *
 * AppState integration: wires React Native AppState to TanStack's focusManager
 * so that queries refetch on app resume — replaces Flutter's
 * WidgetsBindingObserver.
 */
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
