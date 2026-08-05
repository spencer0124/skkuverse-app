/**
 * Shared motion primitives.
 *
 * Rules encoded here (Emil Kowalski's animation standards, translated from
 * CSS/web to Reanimated):
 *
 *   - **Only `transform` and `opacity` animate.** On the web those are the two
 *     properties that skip layout and paint; in RN they are the two Reanimated
 *     can drive entirely on the UI thread. Animating height/padding drops
 *     frames for the same underlying reason.
 *   - **Entering → strong ease-out.** SDS's `bezier.expo` ([0.16, 1, 0.3, 1])
 *     is the same family as the recommended `cubic-bezier(0.23, 1, 0.32, 1)`;
 *     using the existing token keeps this consistent with the rest of the app.
 *     Never ease-in on UI — it delays the exact moment the user is watching.
 *   - **Under 300ms.** 240ms entrance, 160ms press. A faster animation reads as
 *     a faster app even when the work takes the same time.
 *   - **Never scale from 0.** Entrances translate 8pt and fade; nothing in the
 *     real world appears out of nothing.
 *   - **Stagger 30–80ms**, and never block interaction while it plays.
 *   - **Reduced motion means gentler, not absent.** The fade stays (it aids
 *     comprehension); the positional movement is what gets dropped.
 *
 * Reanimated shared values are retargetable mid-flight, so these behave like
 * CSS *transitions* rather than keyframes — an entrance interrupted by another
 * state change continues from where it is instead of snapping to zero.
 */

import { useEffect, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { timingConfig } from '@skkuverse/sds';

const ENTER_MS = 240;
const ENTER_TRAVEL = 8;
const PRESS_MS = 160;
const PRESS_SCALE = 0.97;

/** Recommended gap between staggered siblings. Longer starts to feel slow. */
export const STAGGER_MS = 50;

interface EnterUpProps {
  children: ReactNode;
  /** Stagger offset. Use `index * STAGGER_MS`. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fade + rise entrance. The default for anything appearing in place. */
export function EnterUp({ children, delay = 0, style }: EnterUpProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      reduced ? 0 : delay,
      withTiming(1, timingConfig('expo', reduced ? 200 : ENTER_MS)),
    );
  }, [delay, reduced, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Reduced motion keeps the fade and drops the travel.
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * ENTER_TRAVEL }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Press feedback for any tappable surface. `scale` also scales the children
 * (text, icons), which is exactly what makes the whole control feel physically
 * pushed rather than just tinted.
 */
export function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animated}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={(e) => {
          if (!reduced) scale.value = withTiming(PRESS_SCALE, timingConfig('expo', PRESS_MS));
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!reduced) scale.value = withTiming(1, timingConfig('expo', PRESS_MS));
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
