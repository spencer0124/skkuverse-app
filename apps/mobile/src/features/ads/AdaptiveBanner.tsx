import { useRef, useState, useCallback } from 'react';
import { Animated, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BannerAd,
  BannerAdSize,
  useForeground,
} from 'react-native-google-mobile-ads';

/** Estimate adaptive banner height from screen width (Google sizing rules). */
function estimateBannerHeight(screenWidth: number): number {
  if (screenWidth <= 400) return 50;
  if (screenWidth <= 728) return 60;
  return 90;
}

/**
 * Adaptive banner ad anchored to the bottom of a screen.
 * Pre-reserves height to avoid layout pop-in, fades in on load.
 */
export function AdaptiveBanner({ unitId }: { unitId: string }) {
  const bannerRef = useRef<BannerAd>(null);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [bannerHeight, setBannerHeight] = useState(estimateBannerHeight(screenWidth));
  const opacity = useRef(new Animated.Value(0)).current;

  // iOS: reload ad when app returns to foreground (WKWebView can suspend)
  useForeground(() => {
    Platform.OS === 'ios' && bannerRef.current?.load();
  });

  const handleAdLoaded = useCallback(
    (dimensions: { width: number; height: number }) => {
      if (dimensions.height && dimensions.height !== bannerHeight) {
        setBannerHeight(dimensions.height);
      }
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    },
    [bannerHeight, opacity],
  );

  return (
    <View style={{ height: bannerHeight + insets.bottom, paddingBottom: insets.bottom }}>
      <Animated.View style={{ flex: 1, opacity }}>
        <BannerAd
          ref={bannerRef}
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          onAdLoaded={(dimensions) => {
            if (__DEV__) console.log('[AdMob] Banner loaded:', unitId, dimensions);
            handleAdLoaded(dimensions);
          }}
          onAdFailedToLoad={(error) => {
            if (__DEV__) console.log('[AdMob] Banner failed:', unitId, error.message);
          }}
        />
      </Animated.View>
    </View>
  );
}
