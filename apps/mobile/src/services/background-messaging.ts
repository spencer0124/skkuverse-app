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

  try {
    await notifee.incrementBadgeCount(1);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] incrementBadgeCount failed:', e);
  }

  notificationStore.getState().incrementUnread();
}
