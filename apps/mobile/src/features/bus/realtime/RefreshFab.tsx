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
    lottieRef.current?.reset();
    lottieRef.current?.play();
    onPress();
  };

  if (GLASS_AVAILABLE) {
    return (
      <View
        pointerEvents="box-none"
        style={[styles.fabContainer, glassStyles.shadow, { bottom: bottomOffset }]}
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

// Glass FAB float shadow — between SdsShadows.card (too subtle) and elevated
// (too strong against Liquid Glass specular). To be tuned in iOS 26 simulator
// against shadow-removed and elevated variants; promote to a token if it sticks.
const glassStyles = StyleSheet.create({
  shadow: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
