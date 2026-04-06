/**
 * Generic WebView screen — loads a URL with bridge message handling.
 *
 * Route params: { title, color, url }
 * Used by: bus info buttons, SDUI webview actions, campus map
 */

import { useRef, useCallback } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SdsColors } from '@skkuverse/shared';
import { Navbar } from '@skkuverse/sds';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { AdUnitIds } from '@/utils/ad-helper';
import { parseWebMessage } from '@skkuverse/bridge';

export default function WebViewScreen() {
  const { title, url } = useLocalSearchParams<{
    title: string;
    color: string;
    url: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = parseWebMessage(event.nativeEvent.data);
      if (!msg) return;

      switch (msg.type) {
        case 'web:open-url':
          Linking.openURL(msg.url);
          break;
        case 'web:navigate':
          router.push(msg.path as never);
          break;
        case 'web:map-select':
          // TODO: show place info bottom sheet
          break;
      }
    },
    [router],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Navbar
        left={<Navbar.BackButton onPress={() => router.back()} />}
        title={title}
      />

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url ?? '' }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />

      <AdaptiveBanner unitId={AdUnitIds.webviewBanner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  webview: {
    flex: 1,
  },
});
