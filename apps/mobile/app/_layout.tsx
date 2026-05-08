import { useEffect, useRef } from 'react';
import {
  Stack,
  usePathname,
  useGlobalSearchParams,
  useNavigation,
  useRootNavigationState,
  router,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ErrorBoundary } from '@/providers/ErrorBoundary';
import { QueryProvider } from '@/providers/QueryProvider';
import { InitGate } from '@/providers/InitGate';
import { SDSProvider } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import { logScreenView } from '@/services/analytics';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { defaultHeaderOptions } from '@/lib/header-options';
import { pendingExternalNoticeLink } from '@/lib/pending-external-notice-link';
import { devLog } from '@/services/dev-log';

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
  '/login': 'login_screen',
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
 * External-entry deep-link consumer. Universal links and FCM taps stash a
 * pending {sourceId, articleNo} in pendingExternalNoticeLink and route the
 * navigation to /(tabs)/notices first; this component pushes the actual
 * detail screen on the next animation frame once navigation root is ready.
 *
 * Hosted as its own component (not inlined in RootLayout) because
 * useRootNavigationState re-renders on every nav state change — keeping it
 * isolated here prevents the entire RootLayout subtree from re-rendering.
 */
function PendingNoticeLinkConsumer() {
  const navState = useRootNavigationState();

  useEffect(() => {
    // RELEASE-GATE(debug-menu): navState 변화 로깅 — 가설 B(race) vs D(dedupe)
    // 분리용. timestamp 비교로 router.push 호출과 navState ready 선후 판정.
    // 의도: navState.key 변화 시점만 캡처 (root mount 1회) — index/routeCount는
    // 그 시점의 부수 정보일 뿐 deps에 넣으면 매 push마다 재실행됨.
    devLog('rootNavState.change', {
      hasKey: !!navState?.key,
      index: navState?.index,
      routeCount: navState?.routes?.length,
    });

    if (!navState?.key) return; // wait until navigation root is mounted

    const tryConsume = () => {
      const p = pendingExternalNoticeLink.consume();
      devLog('pendingLink.tryConsume', {
        navStateKey: !!navState?.key,
        hasPending: !!p,
      });
      if (!p) return;
      // Defer to next frame so the /(tabs)/notices navigate dispatched by the
      // caller commits before we push detail. Same-tick push risks RNScreens
      // dedupe coalescing the two transitions.
      requestAnimationFrame(() => {
        router.push(`/notices/${p.sourceId}/${p.articleNo}`);
      });
    };

    tryConsume(); // cold-start: +native-intent set the pending before tree mount
    return pendingExternalNoticeLink.subscribe(tryConsume); // warm-start follow-ups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  return null;
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
  // ── Notification tap & foreground message handling ──
  useNotificationHandler();

  const { t } = useT();

  // ── Centralized screen view logging ──
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string>>();
  const lastLoggedScreen = useRef<string>('');
  const navigation = useNavigation();

  useEffect(() => {
    const screenName = resolveScreenName(pathname, params);
    if (screenName && screenName !== lastLoggedScreen.current) {
      lastLoggedScreen.current = screenName;
      logScreenView(screenName);
    }
    // DIAG: blank-entry investigation. Logs root Stack state on every
    // pathname change so we can see exactly what UIKit's long-press back
    // history will read from. Remove once root cause is identified.
    if (__DEV__) {
      const state = navigation.getState();
      console.log('[diag/back-history]', JSON.stringify({
        pathname,
        index: state?.index,
        routes: state?.routes?.map((r) => ({
          name: r.name,
          path: (r as { path?: string }).path,
          params: r.params,
        })),
      }, null, 2));
    }
  }, [pathname, params, navigation]);
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
        <SDSProvider>
          <QueryProvider>
            <InitGate>
              <BottomSheetModalProvider>
              <Stack screenOptions={defaultHeaderOptions}>
                {/* (tabs) — outer Stack header hidden; each tab has its own
                    nested Stack inside (e.g. (home)/_layout.tsx) that owns the
                    header. This avoids headerShown toggling on tab switch
                    (which previously caused content to slide up/down). */}
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Skkuverse' }} />
                {/* `/` redirect catch-all (app/index.tsx). Production paths
                    (cold-start + SDUI) route directly to /(tabs)/<lastTab>,
                    so this entry is unreachable in practice — but keeping
                    the title set means any future leak shows a labeled "홈"
                    row instead of a blank one in iOS long-press back history. */}
                <Stack.Screen
                  name="index"
                  options={{ headerShown: false, title: t('nav.home') }}
                />
                {/* bus/notices flattened — leaf routes register directly with
                    root Stack so push-from-tab gives an automatic back button.
                    Title/headerRight set inline in each screen file. */}

                {/* Special: search input occupies the header slot */}
                <Stack.Screen
                  name="search"
                  options={{
                    headerShown: false,
                    animation: 'none',
                  }}
                />

                {/* Terminal screens — native header on, static titles via i18n */}
                <Stack.Screen
                  name="settings/index"
                  options={{ title: t('settings.title') }}
                />
                <Stack.Screen
                  name="notifications/settings"
                  options={{ title: t('notifications.settings') }}
                />
                <Stack.Screen
                  name="notifications/essential"
                  options={{ title: t('notifications.essential') }}
                />
                <Stack.Screen
                  name="notifications/services"
                  options={{ title: t('notifications.services') }}
                />
                <Stack.Screen
                  name="notifications/notices"
                  options={{ title: t('notifications.notices') }}
                />
                <Stack.Screen
                  name="notices/saved"
                  options={{ title: t('notices.saved') }}
                />
                {/* RELEASE-GATE(debug-menu): 정식 App Store 출시 전 이 entry +
                    app/settings/debug-logs.tsx + settings 디버깅 row 모두 제거. */}
                <Stack.Screen
                  name="settings/debug-logs"
                  options={{ title: '디버깅 로그' }}
                />
                <Stack.Screen
                  name="map/hssc"
                  options={{ title: '인사캠 건물지도' }}
                />
                <Stack.Screen
                  name="map/hssc-credit"
                  options={{ title: '인사캠 건물지도' }}
                />
                {/* Dynamic title — set inline in webview screen via <Stack.Screen options /> */}
                <Stack.Screen name="webview" />

                {/* Modals/full-screen — keep headerless */}
                <Stack.Screen
                  name="onboarding"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="login"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="sds-preview"
                  options={{
                    title: 'SDS Preview',
                    presentation: 'modal',
                  }}
                />
                {/* TODO: Remove — temporary FCM debug screen */}
                <Stack.Screen
                  name="debug-fcm"
                  options={{
                    presentation: 'modal',
                  }}
                />
                {/* Notices source picker — native iOS UISheetPresentationController
                    on iOS 16+ via `presentation: 'formSheet'`. Detents [0.8, 1.0]
                    give an 80% landing height with drag-to-full. Android falls
                    back to a regular modal (no native partial sheet). */}
                <Stack.Screen
                  name="notices/picker"
                  options={{
                    headerShown: false,
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.8, 1.0],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 16,
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
              </Stack>
              <PendingNoticeLinkConsumer />
              <StatusBar style="dark" />
              </BottomSheetModalProvider>
            </InitGate>
          </QueryProvider>
        </SDSProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
