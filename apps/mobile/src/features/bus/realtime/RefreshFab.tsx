/**
 * Refresh FAB — floating action button with Lottie animation.
 *
 * iOS 26+: native UIGlassEffect via expo-glass-effect (`GlassView`).
 * iOS<26 / Android: existing solid color FAB (no visual change).
 *
 * Lottie asset from skkumap: assets/lottie/refresh.json
 */

import { useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsShadows } from '@skkuverse/shared';
import { glassFloatShadow } from '@skkuverse/sds';
import { logBusContentSelect } from '@/services/analytics';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

/** Estimate adaptive banner height from screen width (must match AdaptiveBanner). */
function estimateBannerHeight(screenWidth: number): number {
  if (screenWidth <= 400) return 50;
  if (screenWidth <= 728) return 60;
  return 90;
}

interface RefreshFabProps {
  color: string;
  onPress: () => void;
}

export function RefreshFab({ color, onPress }: RefreshFabProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomOffset = estimateBannerHeight(width) + insets.bottom + 16;
  const lottieRef = useRef<LottieView>(null);

  const handlePress = () => {
    logBusContentSelect({ content_type: 'realtime_refresh', item_id: 'fab' });
    lottieRef.current?.reset();
    lottieRef.current?.play();
    onPress();
  };

  if (GLASS_AVAILABLE) {
    return (
      <View
        pointerEvents="box-none"
        style={[styles.fabContainer, glassFloatShadow, { bottom: bottomOffset }]}
      >
        <GlassView
          style={styles.fabSurface}
          glassEffectStyle="regular"
          isInteractive
        >
          <Pressable
            style={({ pressed }) => [
              styles.pressable,
              { transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}
            onPress={handlePress}
          >
            <LottieView
              ref={lottieRef}
              source={require('../../../../assets/lottie/refresh.json')}
              style={styles.lottie}
              autoPlay={false}
              loop={false}
              colorFilters={[
                { keypath: 'Layer 1 Outlines.Group 1.Stroke 1', color },
                { keypath: 'Layer 1 Outlines.Group 2.Stroke 1', color },
              ]}
            />
          </Pressable>
        </GlassView>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fabContainer,
        styles.fabSurface,
        SdsShadows.elevated,
        { backgroundColor: color, opacity: pressed ? 0.8 : 1, bottom: bottomOffset },
      ]}
      onPress={handlePress}
    >
      <LottieView
        ref={lottieRef}
        source={require('../../../../assets/lottie/refresh.json')}
        style={styles.lottie}
        autoPlay={false}
        loop={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  fabSurface: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 35,
    height: 35,
  },
});

