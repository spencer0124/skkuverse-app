import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/providers/ErrorBoundary';
import { QueryProvider } from '@/providers/QueryProvider';
import { InitGate } from '@/providers/InitGate';

/**
 * Root layout — provider hierarchy:
 *
 * ErrorBoundary (outermost — catches errors from any child)
 *   > QueryProvider (QueryClient exists before queries fire)
 *     > InitGate (gates navigation until auth is ready)
 *       > Stack + StatusBar
 *
 * Flutter source: lib/main.dart (runApp wrapping)
 */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <InitGate>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="bus" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="dark" />
        </InitGate>
      </QueryProvider>
    </ErrorBoundary>
  );
}
