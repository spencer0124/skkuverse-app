/**
 * Schedule screen loading skeleton.
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

export function ScheduleSkeleton() {
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
      {/* Service tabs placeholder */}
      <View style={styles.tabsRow}>
        <Animated.View style={[styles.tab, animatedStyle]} />
        <Animated.View style={[styles.tab, { width: 60 }, animatedStyle]} />
      </View>

      {/* Day selector placeholder */}
      <View style={styles.daysRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View key={i} style={[styles.dayChip, animatedStyle]} />
        ))}
      </View>

      {/* Schedule rows placeholder */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View key={i} style={styles.scheduleRow}>
          <Animated.View style={[styles.dot, animatedStyle]} />
          <Animated.View style={[styles.timePlaceholder, animatedStyle]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    width: 80,
    height: 32,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey200,
  },
  daysRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  dayChip: {
    width: 44,
    height: 52,
    borderRadius: SdsRadius.sm,
    backgroundColor: SdsColors.grey200,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SdsColors.grey200,
  },
  timePlaceholder: {
    width: 60,
    height: 16,
    borderRadius: SdsRadius.xs,
    backgroundColor: SdsColors.grey200,
  },
});
