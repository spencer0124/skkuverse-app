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
