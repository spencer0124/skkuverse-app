/**
 * SDS Shadow Tokens.
 *
 * Primary format: `boxShadow` string (RN 0.76+ with New Architecture).
 * Fallback: legacy iOS shadow props + Android elevation for compatibility.
 *
 * Flutter source: lib/design/sds_shadows.dart
 */

interface SdsShadowToken {
  /** CSS-like boxShadow string (RN 0.76+ New Architecture) */
  boxShadow: string;
  /** Legacy iOS shadow props + Android elevation */
  legacy: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

/** Card — 0 1px 3px rgba(0,0,0,0.04) */
const card: SdsShadowToken = {
  boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.04)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
};

/** Elevated elements (FAB etc.) — 0 4px 12px rgba(0,0,0,0.08) */
const elevated: SdsShadowToken = {
  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

/** Bottom sheet — 0 -2px 8px rgba(0,0,0,0.06) */
const bottomSheet: SdsShadowToken = {
  boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.06)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
};

/**
 * Floating element over Liquid Glass — 0 2px 8px rgba(0,0,0,0.06).
 *
 * Sits between `card` (too subtle to lift a floating control off a map) and
 * `elevated` (too strong — it clashes with the Glass specular highlight). Apple
 * HIG floating-element guidance. Used by the search bar, the realtime FAB and
 * the event map's floating controls, all of which have a Glass branch on iOS 26
 * and a solid-white fallback below it.
 */
const glassFloat: SdsShadowToken = {
  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};

/** Segmented control indicator — 0 1px 2px rgba(0,0,0,0.09) */
const segmentedIndicator: SdsShadowToken = {
  boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.09)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.09,
    shadowRadius: 2,
    elevation: 1,
  },
};

export const SdsShadows = {
  card,
  elevated,
  bottomSheet,
  glassFloat,
  segmentedIndicator,
} as const;
