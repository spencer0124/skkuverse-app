import { useEffect, useRef } from 'react';
import notifee from '@notifee/react-native';
import { notificationStore } from '@skkuverse/shared';
import {
  getInitialNotification,
  onNotificationOpenedApp,
  onForegroundMessage,
} from '@/services/messaging';
import {
  navigateFromNotification,
  type NotificationData,
} from '@/services/notification-router';
import { mapCategoryToChannel } from '@/services/notification-channels';

/**
 * Root-level hook that handles notification taps and foreground messages.
 *
 * Must be called inside RootLayout (after InitGate) so the router is available.
 *
 * Handles three scenarios:
 * 1. Quit-state: App launched by tapping a notification → getInitialNotification
 * 2. Background-state: App brought to foreground by tap → onNotificationOpenedApp
 * 3. Foreground: Message arrives while app is visible → onForegroundMessage
 *    (Notifee displayNotification + badge increment; OS does NOT auto-show in foreground)
 */
export function useNotificationHandler() {
  const initialHandled = useRef(false);

  useEffect(() => {
    // 1. Quit-state: check if app was opened via notification tap
    if (!initialHandled.current) {
      initialHandled.current = true;
      getInitialNotification().then((message) => {
        if (message?.data) {
          navigateFromNotification(message.data as NotificationData);
        }
      });
    }

    // 2. Background-state: notification tap while app is in background
    const unsubscribeOpened = onNotificationOpenedApp((message) => {
      if (message.data) {
        navigateFromNotification(message.data as NotificationData);
      }
    });

    // 3. Foreground: message arrives while app is active
    const unsubscribeForeground = onForegroundMessage(async (message) => {
      if (__DEV__) {
        console.log('[fcm] foreground message:', message.messageId, message.data);
      }

      const { notification, data } = message;
      if (!notification) return;

      const category =
        typeof data?.category === 'string' ? data.category : undefined;

      try {
        await notifee.displayNotification({
          title: notification.title,
          body: notification.body,
          android: {
            channelId: mapCategoryToChannel(category),
            pressAction: { id: 'default' },
          },
        });
      } catch (e) {
        if (__DEV__) console.warn('[notifee] displayNotification failed:', e);
      }

      try {
        await notifee.incrementBadgeCount(1);
      } catch (e) {
        if (__DEV__) console.warn('[notifee] incrementBadgeCount failed:', e);
      }

      notificationStore.getState().incrementUnread();
    });

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
    };
  }, []);
}
