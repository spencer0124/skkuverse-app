import notifee, { EventType } from '@notifee/react-native';
import { stashNotificationTap, type NotificationData } from '@/services/notification-tap';
import { devLog } from '@/services/dev-log';

/**
 * Notifee background/quit event handler — registered at module scope in index.ts.
 *
 * Covers the gap that FCM's own handlers cannot: a notification the app DREW
 * ITSELF with notifee (which is what happens for every message arriving in the
 * foreground) is not an FCM-displayed notification, so tapping it later fires
 * neither `onNotificationOpenedApp` nor `getInitialNotification`. Before this
 * existed, "app open → notification arrives → user taps it from the tray a
 * minute later" silently did nothing — the single most common pattern during an
 * event.
 *
 * Uses `stashNotificationTap`, never `navigateFromNotification`: this can run in
 * a headless context with no navigator at all. The pending holders are module
 * state in the same bundle, so the consumers in `app/_layout.tsx` drain them
 * once navigation is ready — the same mechanism `+native-intent.tsx` relies on
 * for a cold-start deep link.
 */
export function registerBackgroundNotificationEvents(): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    devLog('notifee.onBackgroundEvent', {
      type,
      eventName: EventType[type] ?? String(type),
      dataKeys: detail.notification?.data ? Object.keys(detail.notification.data) : null,
    });

    if (type !== EventType.PRESS) return;

    const data = detail.notification?.data as NotificationData | undefined;
    const stashed = stashNotificationTap(data);
    devLog('notifee.onBackgroundEvent.stash', { stashed });
  });
}
