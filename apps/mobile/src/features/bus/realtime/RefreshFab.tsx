/**
 * Refresh FAB — floating action button with Lottie animation.
 *
 * Lottie asset from skkumap: assets/lottie/refresh.json
 */

import { useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { SdsShadows } from '@skkuverse/shared';

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

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...SdsShadows.elevated,
  },
  lottie: {
    width: 35,
    height: 35,
  },
});
