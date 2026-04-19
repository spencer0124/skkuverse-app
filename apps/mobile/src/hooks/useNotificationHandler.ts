import { useEffect, useRef } from 'react';
import {
  getInitialNotification,
  onNotificationOpenedApp,
  onForegroundMessage,
} from '@/services/messaging';
import {
  navigateFromNotification,
  type NotificationData,
} from '@/services/notification-router';

/**
 * Root-level hook that handles notification taps and foreground messages.
 *
 * Must be called inside RootLayout (after InitGate) so the router is available.
 *
 * Handles three scenarios:
 * 1. Quit-state: App launched by tapping a notification → getInitialNotification
 * 2. Background-state: App brought to foreground by tap → onNotificationOpenedApp
 * 3. Foreground: Message arrives while app is visible → onForegroundMessage
 *    (Phase 3 will add Notifee in-app notification display here)
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
    const unsubscribeForeground = onForegroundMessage((message) => {
      if (__DEV__) {
        console.log('[fcm] foreground message:', message.messageId, message.data);
      }
      // Phase 3: Notifee displayNotification here
    });

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
    };
  }, []);
}
