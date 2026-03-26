/**
 * Pulse animation — expanding circle that fades out, repeating.
 *
 * Flutter source: lib/features/transit/widgets/businfo_component.dart (pulse)
 */

import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface PulseAnimationProps {
  color: string;
  size?: number;
}

export function PulseAnimation({ color, size = 28 }: PulseAnimationProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.7, { duration: 1200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [scale, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.pulse,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        pulseStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pulse: {
    position: 'absolute',
  },
});
