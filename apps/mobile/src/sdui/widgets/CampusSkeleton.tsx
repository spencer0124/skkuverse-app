/**
 * Campus tab loading skeleton — shimmer placeholders.
 *
 * Uses Reanimated for a looping opacity pulse animation.
 * Mimics the expected layout: title placeholder + 4-button grid.
 */

import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { SdsColors, SdsRadius } from '@skkuuniverse/shared';

const BUTTON_SIZE = 77;

export function CampusSkeleton() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Section title placeholder */}
      <Animated.View style={[styles.titlePlaceholder, animatedStyle]} />

      {/* Button grid placeholder */}
      <View style={styles.gridRow}>
        {[0, 1, 2, 3].map((i) => (
          <Animated.View key={i} style={[styles.buttonPlaceholder, animatedStyle]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  titlePlaceholder: {
    width: 120,
    height: 20,
    borderRadius: SdsRadius.xs,
    backgroundColor: SdsColors.grey200,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  buttonPlaceholder: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey200,
  },
});
