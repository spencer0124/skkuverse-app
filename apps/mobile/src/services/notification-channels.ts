import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

/**
 * Android Notification Channels — created once on app startup.
 *
 * Category-based (not per-department) so users can fine-tune importance
 * per category in OS settings without drowning in 68+ department channels.
 *
 * Channel IDs are stable — changing them requires migration.
 */

export const NotificationChannelId = {
  ACADEMIC: 'notice_academic',
  SCHOLARSHIP: 'notice_scholarship',
  CAREER: 'notice_career',
  GENERAL: 'notice_general',
  DEPARTMENT: 'notice_department',
  ESSENTIAL: 'notice_essential',
  SERVICES: 'notice_services',
  /**
   * One shared channel for every mini app, not one per mini app: channels are
   * created at app startup and the app does not hold the registry at that
   * moment. A device that has not yet received this channel falls back to the
   * default one — the notification still arrives, and only per-channel
   * importance is lost until the update lands.
   */
  MINIAPP: 'miniapp_general',
} as const;

const CHANNELS = [
  {
    id: NotificationChannelId.ESSENTIAL,
    name: '필수 알림',
    importance: AndroidImportance.HIGH,
  },
  {
    id: NotificationChannelId.SERVICES,
    name: '다른 서비스',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: NotificationChannelId.ACADEMIC,
    name: '학사 공지',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: NotificationChannelId.SCHOLARSHIP,
    name: '장학 공지',
    importance: AndroidImportance.HIGH,
  },
  {
    id: NotificationChannelId.CAREER,
    name: '취업·모집',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: NotificationChannelId.GENERAL,
    name: '일반·행사',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: NotificationChannelId.DEPARTMENT,
    name: '학과 공지',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: NotificationChannelId.MINIAPP,
    name: '미니앱 알림',
    importance: AndroidImportance.DEFAULT,
  },
] as const;

/**
 * Create all notification channels. Safe to call repeatedly —
 * existing channels are updated, not duplicated.
 *
 * No-op on iOS (Notifee handles this gracefully).
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Promise.all(
      CHANNELS.map((ch) =>
        notifee.createChannel({
          id: ch.id,
          name: ch.name,
          importance: ch.importance,
        }),
      ),
    );
  } catch (e) {
    if (__DEV__) console.warn('[notifee] createChannel failed:', e);
  }
}

/**
 * Pick a channel for a payload the app is about to display itself.
 *
 * Message type comes first because a mini-app payload carries no `category` at
 * all (see docs/reference/miniapp-notification-payload.md, Surface 2), so a
 * category-only lookup would quietly file every mini-app notification under
 * 일반·행사 — the wrong OS-level control for the user to turn off.
 *
 * NOT yet mirrored on the Cloud Function side. `functions/src/channels.ts` maps
 * notice categories only and defaults to `notice_general`, and until it gains a
 * `miniapp` branch the SAME notification lands in two different user-facing
 * channels depending on app state: 미니앱 알림 when the app drew it in the
 * foreground, 일반 공지 when the OS drew it in background or quit. Muting one in
 * Android settings would then silence only half of them. That mirror is part of
 * the Cloud Functions half (spencer0124/skkuverse#17), which also owns the
 * `android.notification.channelId` the OS reads on the path where this function
 * never runs.
 */
export function resolveNotificationChannel(
  data: Record<string, unknown> | undefined,
): string {
  if (data?.type === 'miniapp') return NotificationChannelId.MINIAPP;
  return mapCategoryToChannel(
    typeof data?.category === 'string' ? data.category : undefined,
  );
}

/**
 * Map a notice category string from the notification payload
 * to a Notification Channel ID.
 */
export function mapCategoryToChannel(category?: string): string {
  switch (category) {
    case 'academic':
      return NotificationChannelId.ACADEMIC;
    case 'scholarship':
      return NotificationChannelId.SCHOLARSHIP;
    case 'career':
    case 'recruitment':
      return NotificationChannelId.CAREER;
    case 'essential':
      return NotificationChannelId.ESSENTIAL;
    case 'services':
      return NotificationChannelId.SERVICES;
    default:
      return NotificationChannelId.GENERAL;
  }
}
