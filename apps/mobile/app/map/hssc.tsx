/**
 * HSSC Building Map — webview wrapper for the deployed building map.
 *
 * Route: /map/hssc
 * URL: https://webview.skkuuniverse.com/#/map/hssc
 */

import { useRef, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors, SdsTypo } from '@skkuuniverse/shared';
import { parseWebMessage } from '@skkuuniverse/bridge';

const WEBVIEW_URL = 'https://webview.skkuuniverse.com/#/map/hssc';

export default function HSSCMapScreen() {
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
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color={SdsColors.grey900} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          인사캠 건물지도
        </Text>
        <Pressable
          onPress={() => router.push('/map/hssc-credit' as never)}
          style={styles.iconButton}
          hitSlop={8}
        >
          <MaterialIcons name="info-outline" size={24} color={SdsColors.grey900} />
        </Pressable>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: WEBVIEW_URL }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  webview: {
    flex: 1,
  },
});
