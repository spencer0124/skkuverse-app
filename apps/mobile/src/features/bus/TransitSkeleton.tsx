/**
 * Transit tab loading skeleton — shimmer placeholders.
 *
 * Follows CampusSkeleton pattern: Reanimated opacity pulse.
 * Mimics 5 BusListItemRow layouts.
 */

import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { SdsColors, SdsRadius } from '@skkuverse/shared';

function SkeletonRow({ opacity }: { opacity: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.icon, animatedStyle]} />
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Animated.View style={[styles.labelPlaceholder, animatedStyle]} />
          <Animated.View style={[styles.badgePlaceholder, animatedStyle]} />
        </View>
        <Animated.View style={[styles.subtitlePlaceholder, animatedStyle]} />
      </View>
    </View>
  );
}

export function TransitSkeleton() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  return (
    <View style={styles.container}>
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonRow key={i} opacity={opacity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: SdsRadius.sm,
    backgroundColor: SdsColors.grey200,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelPlaceholder: {
    width: 100,
    height: 16,
    borderRadius: SdsRadius.xs,
    backgroundColor: SdsColors.grey200,
  },
  badgePlaceholder: {
    width: 40,
    height: 16,
    borderRadius: 5,
    backgroundColor: SdsColors.grey200,
  },
  subtitlePlaceholder: {
    width: 160,
    height: 13,
    borderRadius: SdsRadius.xs,
    backgroundColor: SdsColors.grey200,
  },
});
