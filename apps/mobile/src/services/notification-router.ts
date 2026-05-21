import { router } from 'expo-router';
import { pendingExternalNoticeLink } from '@/lib/pending-external-notice-link';
import { devLog } from '@/services/dev-log';

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
  // RELEASE-GATE(debug-menu): entry/exit timestamp는 가설 B(race) 판정용 —
  // rootNavState.change 시점과 비교해서 push 시점 navState ready 여부 결정.
  devLog('navigateFromNotification.entry', {
    type: data?.type ?? null,
    keys: data ? Object.keys(data) : null,
  });

  if (!data?.type) {
    devLog('navigateFromNotification.exit', { result: false, reason: 'no-type' });
    return false;
  }

  switch (data.type) {
    case 'notice': {
      // Strict string narrowing — FCM payloads are typed as string, but type
      // closure on the union prevents number/boolean from sneaking into the
      // template literal below via consume().
      if (typeof data.sourceId !== 'string' || typeof data.articleNo !== 'string') {
        devLog('navigateFromNotification.exit', {
          result: false,
          reason: 'missing-sourceId-or-articleNo',
          hasSourceId: typeof data.sourceId === 'string',
          hasArticleNo: typeof data.articleNo === 'string',
        });
        return false;
      }
      // Activate the notices tab first, then stash the intent. The
      // PendingNoticeLinkConsumer in app/_layout.tsx will pick up the pending
      // entry and push the detail screen on the next animation frame so the
      // back arrow lands on the notices tab.
      // navigate (not push): rewinds to existing notices tab if already in
      // history, switches tab otherwise — both paths avoid stacking a new
      // (tabs) entry on root Stack (which `push` would do, causing a duplicate
      // notices tab in back history when the tap arrives while already on
      // the notices tab).
      router.navigate('/(tabs)/notices');
      pendingExternalNoticeLink.set({
        sourceId: data.sourceId,
        articleNo: data.articleNo,
        source: 'push',
      });
      devLog('navigateFromNotification.exit', { result: true });
      return true;
    }
    default:
      devLog('navigateFromNotification.exit', {
        result: false,
        reason: 'unknown-type',
        type: data.type,
      });
      return false;
  }
}
