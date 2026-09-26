import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@skkuverse/sds';

const RISE_FROM = 28;

/**
 * One floating card of the result screen — the SDS `GlassCard` (Liquid Glass
 * on iOS 26+, a white card with a soft shadow below it). Cards rise one after
 * another (`order`).
 *
 * The rise is an animated style, never an `entering` layout animation:
 * Reanimated mounts a view with `entering` at opacity 0 until its first frame,
 * and a glass view laid out under an ancestor at opacity 0 is never drawn — the
 * card's text floats with no panel behind it. See the gotcha in
 * docs/explanation/campus-map-reconciliation.md.
 */
export function ResultCard({ order, children }: { order: number; children: ReactNode }) {
  const y = useSharedValue(RISE_FROM);
  useEffect(() => {
    y.value = withDelay(
      order * 70,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [order, y]);
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={rise}>
      <GlassCard contentStyle={styles.content}>{children}</GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20, paddingHorizontal: 18 },
});
