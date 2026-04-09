import { useEffect, useRef } from 'react';
import { Stack, usePathname, useGlobalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/providers/ErrorBoundary';
import { QueryProvider } from '@/providers/QueryProvider';
import { InitGate } from '@/providers/InitGate';
import { SDSProvider } from '@skkuverse/sds';
import { logScreenView } from '@/services/analytics';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// ── Screen View tracking ──────────────────────────────────────────
const SCREEN_NAMES: Record<string, string> = {
  '/campus': 'campus_screen',
  '/transit': 'transit_screen',
  '/search': 'search_screen',
  '/bus/realtime': 'bus_realtime_screen',
  '/bus/schedule': 'bus_schedule_screen',
  '/map/hssc': 'map_hssc_screen',
  '/map/hssc-credit': 'map_hssc_credit_screen',
};

function resolveScreenName(
  pathname: string,
  params: Record<string, string | string[]>,
): string | null {
  if (pathname === '/webview') {
    const title = typeof params.title === 'string' ? params.title : '';
    const slug = title.toLowerCase().replace(/\s+/g, '_');
    return slug ? `webview_${slug}_screen` : 'webview_screen';
  }
  return SCREEN_NAMES[pathname] ?? null;
}

/**
 * Root layout — provider hierarchy:
 *
 * ErrorBoundary (outermost — catches errors from any child)
 *   > GestureHandlerRootView (required by @gorhom/bottom-sheet)
 *     > SDSProvider (design system theme + overlay)
 *       > QueryProvider (QueryClient exists before queries fire)
 *         > InitGate (gates navigation until auth is ready)
 *           > Stack + StatusBar
 *
 * Flutter source: lib/main.dart (runApp wrapping)
 */
export default function RootLayout() {
  // ── Centralized screen view logging ──
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string>>();
  const lastLoggedScreen = useRef<string>('');

  useEffect(() => {
    const screenName = resolveScreenName(pathname, params);
    if (screenName && screenName !== lastLoggedScreen.current) {
      lastLoggedScreen.current = screenName;
      logScreenView(screenName);
    }
  }, [pathname, params]);
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SDSProvider>
          <QueryProvider>
            <InitGate>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="bus" options={{ headerShown: false }} />
                <Stack.Screen
                  name="search"
                  options={{
                    headerShown: false,
                    animation: 'none',
                  }}
                />
                <Stack.Screen name="map/hssc" options={{ headerShown: false }} />
                <Stack.Screen name="map/hssc-credit" options={{ headerShown: false }} />
                <Stack.Screen name="webview" options={{ headerShown: false }} />
                <Stack.Screen
                  name="sds-preview"
                  options={{
                    title: 'SDS Preview',
                    presentation: 'modal',
                  }}
                />
              </Stack>
              <StatusBar style="dark" />
            </InitGate>
          </QueryProvider>
        </SDSProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
