/**
 * Realtime screen loading skeleton.
 *
 * Mimics the station list layout while config is loading.
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

export function RealtimeSkeleton() {
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
      {/* Top info bar placeholder */}
      <Animated.View style={[styles.infoBar, animatedStyle]} />

      {/* Station rows placeholder */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.stationRow}>
          <Animated.View style={[styles.dot, animatedStyle]} />
          <Animated.View style={[styles.stationName, animatedStyle]} />
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
  infoBar: {
    height: 32,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: SdsRadius.xs,
    backgroundColor: SdsColors.grey200,
  },
  stationRow: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 70,
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SdsColors.grey200,
  },
  stationName: {
    width: 120,
    height: 16,
    borderRadius: SdsRadius.xs,
    backgroundColor: SdsColors.grey200,
  },
});
