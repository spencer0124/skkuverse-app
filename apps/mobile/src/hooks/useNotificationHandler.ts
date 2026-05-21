import { useEffect, useRef } from 'react';
import notifee, { EventType } from '@notifee/react-native';
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
import { devLog } from '@/services/dev-log';

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
        // RELEASE-GATE(debug-menu): cold-start tap 진단 — 가설 A(payload 누락)
        // / B(navigation race) / E(RNFB silence) 분리에 핵심.
        devLog('getInitialNotification.resolve', {
          hasMessage: !!message,
          dataKeys: message?.data ? Object.keys(message.data) : null,
          dataType: typeof message?.data?.type === 'string' ? message.data.type : null,
        });
        if (message?.data) {
          const result = navigateFromNotification(message.data as NotificationData);
          devLog('getInitialNotification.navigate', { result });
        }
      });
    }

    // 2. Background-state: notification tap while app is in background
    const unsubscribeOpened = onNotificationOpenedApp((message) => {
      // RELEASE-GATE(debug-menu): warm-tap 진단.
      devLog('onNotificationOpenedApp', {
        dataKeys: message.data ? Object.keys(message.data) : null,
        dataType: typeof message.data?.type === 'string' ? message.data.type : null,
      });
      if (message.data) {
        const result = navigateFromNotification(message.data as NotificationData);
        devLog('onNotificationOpenedApp.navigate', { result });
      }
    });

    // 3. Foreground: message arrives while app is active
    const unsubscribeForeground = onForegroundMessage(async (message) => {
      // RELEASE-GATE(debug-menu): foreground arrival 진단.
      devLog('onForegroundMessage', {
        messageId: message.messageId,
        dataKeys: message.data ? Object.keys(message.data) : null,
        hasNotification: !!message.notification,
      });

      const { notification, data } = message;
      if (!notification) return;

      const category =
        typeof data?.category === 'string' ? data.category : undefined;

      try {
        await notifee.displayNotification({
          title: notification.title,
          body: notification.body,
          // RELEASE-GATE(debug-menu): foreground tap 시 PRESS handler가 data를
          // 다시 읽으려면 여기서 명시 전달 필요. 가설 C 진단 단계에서 추가.
          data: (data ?? {}) as Record<string, string>,
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

    // 4. Foreground tap (notifee-displayed banner) — 가설 C 진단용 신규 등록.
    // RELEASE-GATE(debug-menu): 진단 단계에서는 PRESS 이벤트만 로깅하고
    // navigation은 안 시킴 (Phase 1에서 진단 결과에 따라 navigation 추가 결정).
    const unsubscribePress = notifee.onForegroundEvent(({ type, detail }) => {
      devLog('notifee.onForegroundEvent', {
        type,
        eventName: EventType[type] ?? String(type),
        hasNotification: !!detail.notification,
        dataKeys: detail.notification?.data
          ? Object.keys(detail.notification.data)
          : null,
      });
    });

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
      unsubscribePress();
    };
  }, []);
}
