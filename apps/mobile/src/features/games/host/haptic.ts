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

const IMPACT: Record<Exclude<HapticStyle, 'success'>, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  soft: Haptics.ImpactFeedbackStyle.Soft,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  // Short and hard: a slip can come every few keys, and the notification
  // pattern would still be buzzing at the next one.
  error: Haptics.ImpactFeedbackStyle.Rigid,
};

export function playGameHaptic(style: HapticStyle): void {
  const done =
    style === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(IMPACT[style]);
  void done.catch(() => {});
}
