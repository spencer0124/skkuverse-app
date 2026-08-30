import notifee from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { notificationStore } from '@skkuverse/shared';

/**
 * Background message handler — registered at module scope in index.ts,
 * before AppRegistry.registerComponent (expo-router/entry).
 *
 * Intentionally does NOT call notifee.displayNotification — hybrid payload
 * (notification + data) lets the OS auto-display in background/quit state,
 * and calling displayNotification here would cause a duplicate banner.
 *
 * Badge handling is best-effort (P0-1 β): increment here when the handler
 * is awake, and let the 공지 탭 useFocusEffect reconcile to 0 on entry.
 * iOS may throttle this handler based on battery / thermal / content-available
 * flag — the reconcile path covers any skipped increments.
 */
export async function backgroundMessageHandler(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  if (__DEV__) {
    console.log('[fcm] background message:', remoteMessage.messageId);
  }

  // Badge what the user can actually see. A data-only message draws no banner,
  // so counting it would inflate the badge for something that was never
  // displayed — and the user would have no way to clear it by reading anything.
  // Keyed on the absent `notification` block rather than on a message type, so
  // the rule holds for every future silent payload without another branch here.
  if (!remoteMessage.notification) return;

  try {
    await notifee.incrementBadgeCount(1);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] incrementBadgeCount failed:', e);
  }

  notificationStore.getState().incrementUnread();
}
