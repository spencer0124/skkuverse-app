import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { GlassCard } from '@skkuverse/sds';

/**
 * Rises into place without fading: a glass effect view under a parent whose
 * opacity animates is not drawn at all, so the card moves but never fades.
 */
const RISE = new Keyframe({
  0: { transform: [{ translateY: 28 }] },
  100: { transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
});

/**
 * One floating card of the result screen — the SDS `GlassCard` (Liquid Glass
 * on iOS 26+, a white card with a soft shadow below it). Cards rise one after
 * another (`order`).
 */
export function ResultCard({ order, children }: { order: number; children: ReactNode }) {
  return (
    <Animated.View entering={RISE.duration(320).delay(order * 70)}>
      <GlassCard contentStyle={styles.content}>{children}</GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20, paddingHorizontal: 18 },
});
