import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * One drifting Tossface emoji, absolutely positioned inside a relative parent.
 *
 * Extracted from HeroBanner so the home banner and the first-launch intro's
 * sign-in page render the same motion instead of two drifting copies. The
 * parent owns the box; this owns only the bob.
 *
 * Staggered `delay` is what keeps a cluster from pulsing in unison — without
 * it four emoji rising together read as one moving block rather than a scatter.
 */
export type EmojiSpec = {
  /** The emoji character. Rendered in Tossface, so it stays coloured. */
  ch: string;
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  /** Static tilt, in degrees. Spread these so the cluster looks tossed in. */
  rot: number;
  /** Milliseconds before the bob starts, to break up the cluster's rhythm. */
  delay: number;
  /** Bob travel in points. Default 10, which is what the home banner uses. */
  float?: number;
};

const BOB_DURATION = 4000;
const DEFAULT_FLOAT = 10;

export function FloatingEmoji({ spec }: { spec: EmojiSpec }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withDelay(
      spec.delay,
      withRepeat(
        withTiming(1, {
          duration: BOB_DURATION,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
  }, [bob, spec.delay]);

  const travel = spec.float ?? DEFAULT_FLOAT;

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -travel]) },
      { rotate: `${spec.rot}deg` },
    ],
  }));

  return (
    <Animated.Text
      style={[
        styles.emoji,
        {
          left: spec.left,
          top: spec.top,
          fontSize: spec.size,
          lineHeight: spec.size * 1.2,
        },
        animStyle,
      ]}
    >
      {spec.ch}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  emoji: {
    position: 'absolute',
    // Tossface, not the system emoji font — see the emoji note in CLAUDE.md.
    fontFamily: 'TossFaceFontMac',
  },
});
