/**
 * SDS Animation Duration Tokens (in milliseconds).
 *
 * Flutter source: lib/design/sds_duration.dart
 */
export const SdsDuration = {
  /** 100ms — button press feedback */
  instant: 100,
  /** 150ms — checkbox toggle */
  fast: 150,
  /** 200ms — segment switch, fade */
  normal: 200,
  /** 250ms — accordion expand/collapse */
  slow: 250,
  /** 500ms — progress bar fill */
  slower: 500,
  /** 2000ms — toast display time */
  toast: 2000,
} as const;

/**
 * SDS Animation Curve Tokens.
 *
 * easeOutCubic bezier tuple for Reanimated's `Easing.bezier()`.
 */
export const SdsCurves = {
  /** Standard transition curve — equivalent to Curves.easeOutCubic */
  standard: [0.33, 1, 0.68, 1] as const,
} as const;
