/**
 * `web:haptic` — a first-party page asking for a tap of feedback, e.g. a
 * counter ticking up.
 *
 * `expo-haptics` is already in the native build, so this is JS-only. Failures
 * are swallowed: a device without a haptic engine (or with haptics turned off)
 * should lose the feel, never the page.
 */
import * as Haptics from 'expo-haptics';
import type { WebToAppMessage } from '@skkuverse/bridge';

type HapticStyle = Extract<WebToAppMessage, { type: 'web:haptic' }>['style'];

const IMPACT: Record<HapticStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export function playWebHaptic(style: HapticStyle): void {
  void Haptics.impactAsync(IMPACT[style]).catch(() => {});
}
