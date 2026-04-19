import { router } from 'expo-router';

/**
 * Notification deep link router — converts FCM data payload to Expo Router navigation.
 *
 * The server includes structured data (not URLs) in the notification payload.
 * This module maps that data to the correct in-app route.
 */

export interface NotificationData {
  type?: string;
  notificationId?: string;
  deptId?: string;
  articleNo?: string;
  category?: string;
}

/**
 * Navigate to the screen corresponding to the notification payload.
 * Returns true if navigation was performed, false if the payload was unrecognized.
 */
export function navigateFromNotification(data: NotificationData | undefined): boolean {
  if (!data?.type) return false;

  switch (data.type) {
    case 'notice': {
      if (!data.deptId || !data.articleNo) return false;
      router.push(`/notices/${data.deptId}/${data.articleNo}`);
      return true;
    }
    default:
      if (__DEV__) console.log('[notification-router] unknown type:', data.type);
      return false;
  }
}
