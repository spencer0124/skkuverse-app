import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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
import { resolveNotificationChannel } from '@/services/notification-channels';
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

      // iOS only, and the asymmetry is a real platform difference rather than
      // caution. Notifee routes an event to its background channel by reading
      // UIApplication.applicationState ONE SECOND after the fact
      // (RNNotifee/NotifeeApiModule.m, sendNotifeeCoreEvent). A press
      // foregrounds the app by definition, so a second later the state is
      // Active and the event always goes to the FOREGROUND channel — which has
      // no replay buffer and no subscriber until this hook mounts. A cold start
      // from a tray tap therefore loses it entirely, and RNFB's
      // getInitialNotification above cannot recover it: a notifee-drawn
      // notification carries no gcm.message_id, so RNFB never saw it.
      //
      // Android needs none of this and must NOT have it: NotifeeEventSubscriber
      // picks the channel with isAppInForeground() AT EVENT TIME, so the press
      // correctly reaches the headless handler in background-notification-events.ts.
      // Adding a second source here would risk stashing the same tap twice.
      if (Platform.OS === 'ios') {
        notifee
          .getInitialNotification()
          .then((initial) => {
            devLog('notifee.getInitialNotification', {
              hasNotification: !!initial,
              dataKeys: initial?.notification?.data
                ? Object.keys(initial.notification.data)
                : null,
            });
            if (!initial) return;
            const result = navigateFromNotification(
              initial.notification?.data as NotificationData | undefined,
            );
            devLog('notifee.getInitialNotification.navigate', { result });
          })
          .catch((e) => {
            if (__DEV__) console.warn('[notifee] getInitialNotification failed:', e);
          });
      }
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

      // A data-only payload falls straight through here. The one silent type
      // this app ever had was `eventmap-refresh`, which invalidated the event
      // map's snapshot queries; the server deleted the snapshot tier and the
      // publish push with it, so there is no sender left and nothing to handle.
      if (!notification) return;

      try {
        await notifee.displayNotification({
          title: notification.title,
          body: notification.body,
          // RELEASE-GATE(debug-menu): foreground tap 시 PRESS handler가 data를
          // 다시 읽으려면 여기서 명시 전달 필요. 가설 C 진단 단계에서 추가.
          data: (data ?? {}) as Record<string, string>,
          android: {
            channelId: resolveNotificationChannel(data),
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

    // 4. Foreground tap on a banner notifee drew (case 3 above).
    //
    // The OS does not auto-display in the foreground, so we draw it ourselves —
    // which makes it a notifee-local notification, not an FCM-delivered one.
    // `onNotificationOpenedApp` therefore never fires for it, and without this
    // handler the tap went nowhere. No double-fire risk for the same reason.
    // The background/quit half of this is `background-notification-events.ts`.
    const unsubscribePress = notifee.onForegroundEvent(({ type, detail }) => {
      devLog('notifee.onForegroundEvent', {
        type,
        eventName: EventType[type] ?? String(type),
        hasNotification: !!detail.notification,
        dataKeys: detail.notification?.data
          ? Object.keys(detail.notification.data)
          : null,
      });

      if (type !== EventType.PRESS) return;
      // Foreground by definition, so the navigator is mounted and the
      // tab-activating entry point is the right one.
      const result = navigateFromNotification(
        detail.notification?.data as NotificationData | undefined,
      );
      devLog('notifee.onForegroundEvent.navigate', { result });
    });

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
      unsubscribePress();
    };
  }, []);
}
