/**
 * `game:haptic` — a bundled game asking for a tap of feedback. The game's own
 * vocabulary, not `web:haptic`'s: that one is the open-web bridge, vendored
 * into skkuverse-web, and has no `error`.
 *
 * Failures are swallowed: a device without a haptic engine (or with haptics
 * turned off) should lose the feel, never the game.
 */
import * as Haptics from 'expo-haptics';
import type { HapticStyle } from '@skkuverse/game-host';

const IMPACT: Record<HapticStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  // Short and hard: a slip can come every few keys, and the notification
  // pattern would still be buzzing at the next one.
  error: Haptics.ImpactFeedbackStyle.Rigid,
};

export function playGameHaptic(style: HapticStyle): void {
  void Haptics.impactAsync(IMPACT[style]).catch(() => {});
}
