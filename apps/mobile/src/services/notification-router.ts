import { router } from 'expo-router';
import { applyTap, resolveTap, type NotificationData } from '@/services/notification-tap';

/**
 * Notification deep link router — turns an FCM data payload into navigation.
 *
 * WHERE a tap lands is decided by `resolveNotificationTap` in @skkuverse/shared:
 * pure, unit-tested, and free of expo-router so the same answer holds for every
 * entry point (quit-state launch, warm tap, foreground notifee press,
 * background notifee press). Stashing the result is `notification-tap.ts`, which
 * is also navigation-free. This file adds the one thing that genuinely needs a
 * navigator, and is therefore the only one of the three a headless context must
 * not import.
 */

export { stashNotificationTap } from '@/services/notification-tap';
export type { NotificationData } from '@/services/notification-tap';

/**
 * Navigate to the screen corresponding to the notification payload.
 * Returns true if a destination was resolved, false if the payload was unrecognized.
 *
 * Call only from inside the React tree: it activates a tab before stashing, so
 * backing out of the pushed screen lands somewhere sensible rather than on
 * whatever happened to be on top.
 */
export function navigateFromNotification(data: NotificationData | undefined): boolean {
  const tap = resolveTap(data);

  // navigate (not push): rewinds to an existing tab if it is already in history,
  // switches otherwise — both avoid stacking a second (tabs) entry on the root
  // Stack, which is what `push` would do when the tap arrives while the user is
  // already on that tab.
  if (tap?.kind === 'notice') {
    router.navigate('/(tabs)/notices');
  } else if (tap?.kind === 'miniapp') {
    // Mirrors `+native-intent.tsx`, which returns /(tabs)/home for
    // `skkuverse://m/<slug>` before its consumer pushes the shell.
    router.navigate('/(tabs)/home');
  }
  // An sdui-action gets no tab activation: its destination is a pushed screen
  // (/webview) or an explicit route, and yanking the user to a tab first would
  // change where backing out lands, for no gain.

  return applyTap(tap);
}
