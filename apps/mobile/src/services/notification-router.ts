import { router } from 'expo-router';
import { pendingExternalNoticeLink } from '@/lib/pending-external-notice-link';

/**
 * Notification deep link router — converts FCM data payload to Expo Router navigation.
 *
 * The server includes structured data (not URLs) in the notification payload.
 * This module maps that data to the correct in-app route.
 */

export interface NotificationData {
  type?: string;
  sourceId?: string;
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
      // Strict string narrowing — FCM payloads are typed as string, but type
      // closure on the union prevents number/boolean from sneaking into the
      // template literal below via consume().
      if (typeof data.sourceId !== 'string' || typeof data.articleNo !== 'string') return false;
      // Activate the notices tab first, then stash the intent. The
      // PendingNoticeLinkConsumer in app/_layout.tsx will pick up the pending
      // entry and push the detail screen on the next animation frame so the
      // back arrow lands on the notices tab.
      router.push('/(tabs)/notices');
      pendingExternalNoticeLink.set({
        sourceId: data.sourceId,
        articleNo: data.articleNo,
      });
      return true;
    }
    default:
      if (__DEV__) console.log('[notification-router] unknown type:', data.type);
      return false;
  }
}
