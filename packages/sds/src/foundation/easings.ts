/**
 * SDS Easing Tokens — cloned from @toss/tds-easings, adapted for reanimated.
 *
 * bezier: cubic-bezier curves (for Easing.bezier())
 * spring: spring physics presets (for withSpring())
 */
import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

// ── Bezier Curves ──

export type CubicBezier = [number, number, number, number];
export type BezierType = 'linear' | 'ease' | 'out' | 'expo' | 'back';

export const bezier: Record<BezierType, CubicBezier> = {
  linear: [0, 0, 1, 1],
  ease: [0.6, 0, 0, 0.6],
  out: [0.25, 0.1, 0.25, 1],
  expo: [0.16, 1, 0.3, 1],
  back: [0.34, 1.56, 0.64, 1],
};

/** Get a reanimated Easing function from a bezier type */
export function bezierEasing(type: BezierType) {
  'worklet';
  const [x1, y1, x2, y2] = bezier[type];
  return Easing.bezier(x1, y1, x2, y2);
}

/** Create a reanimated withTiming config from a bezier type */
export function timingConfig(
  type: BezierType,
  duration: number,
): WithTimingConfig {
  const [x1, y1, x2, y2] = bezier[type];
  return {
    duration,
    easing: Easing.bezier(x1, y1, x2, y2),
  };
}

// ── Spring Presets ──

export type SpringType =
  | 'basic'
  | 'small'
  | 'quick'
  | 'medium'
  | 'large'
  | 'slow'
  | 'rapid'
  | 'bounce';

interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/** Raw spring physics values (TDS-compatible) */
export const spring: Record<SpringType, SpringConfig> = {
  basic: { stiffness: 200, damping: 30, mass: 1 },
  small: { stiffness: 480, damping: 50, mass: 1 },
  quick: { stiffness: 800, damping: 55, mass: 1 },
  medium: { stiffness: 270, damping: 25, mass: 1 },
  large: { stiffness: 100, damping: 15, mass: 1 },
  slow: { stiffness: 70, damping: 20, mass: 1 },
  rapid: { stiffness: 1000, damping: 55, mass: 1 },
  bounce: { stiffness: 300, damping: 15, mass: 1 },
};

/** Get a reanimated withSpring config from a spring type */
export function springConfig(type: SpringType): WithSpringConfig {
  const { stiffness, damping, mass } = spring[type];
  return { stiffness, damping, mass };
}
