/**
 * Generic WebView screen — the shell for every web URL that is not a registered
 * mini-app.
 *
 * Route params: { url, title? }
 * Used by: notice "원본 공지 보기", links inside notice markdown, SDUI `webview`
 * and `external` actions, bus info buttons, 분실물.
 *
 * Chrome is deliberately minimal: native header + content + ad banner. The rich
 * browser chrome (service pill, bookmark, share-as-mini-app, add-to-home) lives
 * on /mini-app, where a registry entry gives it something to describe. A notice
 * source page has none of that, so it gets none of it.
 *
 * Bridge access is NOT a property of this screen — it is resolved per message
 * from the loaded document's origin. See features/webview/capabilities.ts.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { SdsColors, getBridgeOrigins, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { parseWebMessage } from '@skkuverse/bridge';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { AdUnitIds } from '@/utils/ad-helper';
import { resolveWebviewCapabilities } from '@/features/webview/capabilities';

/** Host shown as the header title when neither a param nor a page title exists. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export default function WebViewScreen() {
  const { title, url } = useLocalSearchParams<{ title?: string; url?: string }>();
  const { t } = useT();
  const webViewRef = useRef<WebView>(null);

  const startUrl = url ?? '';
  // Page's own <title>, used only when the caller supplied no title.
  const [pageTitle, setPageTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // In-page history depth. Matters more than it used to: this shell now hosts
  // arbitrary multi-page sites (notice originals and the links inside them),
  // where "back" almost always means the previous page, not "close the screen".
  const [canGoBack, setCanGoBack] = useState(false);
  // Mirrored in a ref so the Android BackHandler reads the live value without
  // resubscribing on every navigation.
  const canGoBackRef = useRef(false);

  // param → page <title> → host. Callers that know the destination (bus info,
  // 분실물) pass a title; notice originals and markdown links don't, so the page
  // names itself rather than showing a blank bar.
  const headerTitle = title || pageTitle || hostOf(startUrl);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    if (nav.title) setPageTitle(nav.title);
    setCanGoBack(nav.canGoBack);
    canGoBackRef.current = nav.canGoBack;
  }, []);

  // Android: intercept system/gesture back so it walks the page history first;
  // only close the screen once there's nowhere left to go. (iOS gets the
  // equivalent via the gesture handoff configured on Stack.Screen below.)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true; // handled — don't pop the screen
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const msg = parseWebMessage(event.nativeEvent.data);
    if (!msg) return;

    // Re-resolved on EVERY message against the document that actually posted it
    // — not once at open time. A page that navigates onward must not carry the
    // grant its opener had. Empty set (no config, unknown origin) drops silently.
    const granted = resolveWebviewCapabilities(
      event.nativeEvent.url,
      getBridgeOrigins(),
    );
    if (!granted.includes(msg.type)) return;

    switch (msg.type) {
      case 'web:open-url':
        void Linking.openURL(msg.url).catch(() => {});
        break;
      case 'web:map-select':
        // TODO: show place info bottom sheet. Reachable only from the
        // first-party map pages, which the server no longer routes to.
        break;
    }
  }, []);

  const reload = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      {/* iOS edge-swipe handoff: with page history, the screen-pop gesture is
          OFF so WKWebView owns the swipe (= page back); at the root it's ON so
          the swipe closes the screen. Exactly one recognizer is ever active —
          leaving both on makes the swipe non-deterministic. Mirrors the
          mini-app shell. */}
      <Stack.Screen options={{ title: headerTitle, gestureEnabled: !canGoBack }} />

      <View style={styles.content}>
        <WebView
          ref={webViewRef}
          source={{ uri: startUrl }}
          style={styles.webview}
          onMessage={handleMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onHttpError={({ nativeEvent }) => {
            // 4xx/5xx still fires onLoadEnd with the site's own error page;
            // surface our state instead. Safe to treat as fatal: the native
            // side only dispatches this for the MAIN FRAME
            // (RNCWebViewClient.java `if (request.isForMainFrame())`), so a
            // 404'd image or script on an otherwise-fine page won't trip it.
            if (nativeEvent.statusCode >= 400) setFailed(true);
          }}
          javaScriptEnabled
          domStorageEnabled
          // Paired with gestureEnabled above — only claim the swipe when there
          // is page history to walk (Android no-op).
          allowsBackForwardNavigationGestures={canGoBack}
        />

        {/* Loading veil — covers the white flash before first paint. Not
            `startInLoadingState`, whose default spinner can't be themed. */}
        {loading && !failed ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color={SdsColors.brand} />
          </View>
        ) : null}

        {/* Error state — replaces the browser's raw error page, which leaks a
            different visual language (and a different language) into the app. */}
        {failed ? (
          <View style={styles.overlay}>
            <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900}>
              {t('error.somethingWrong')}
            </Txt>
            <Txt typography="t7" color={SdsColors.grey500} style={styles.errorBody}>
              {t('error.checkNetwork')}
            </Txt>
            <Pressable
              onPress={reload}
              style={styles.retryButton}
              accessibilityRole="button"
            >
              <Txt typography="t6" fontWeight="bold" color="#FFFFFF">
                {t('common.retry')}
              </Txt>
            </Pressable>
          </View>
        ) : null}
      </View>

      <AdaptiveBanner unitId={AdUnitIds.webviewBanner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  // Wraps the WebView so the overlays can be absolutely positioned over the
  // content without also covering the ad banner.
  content: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 32,
    backgroundColor: SdsColors.background,
  },
  errorBody: {
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SdsColors.brand,
  },
});
