import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/providers/ErrorBoundary';
import { QueryProvider } from '@/providers/QueryProvider';
import { InitGate } from '@/providers/InitGate';
import { SDSProvider } from '@skkuverse/sds';

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
                    animation: 'slide_from_bottom',
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
