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
      const hasSourceId = typeof data.sourceId === 'string';
      const hasArticleNo = typeof data.articleNo === 'string';

      if (hasSourceId && hasArticleNo) {
        // Happy path: deep-link to detail. Activate the notices tab first,
        // then stash the intent. PendingNoticeLinkConsumer in app/_layout.tsx
        // pushes the detail on the next frame so back arrow lands on the tab.
        router.push('/(tabs)/notices');
        pendingExternalNoticeLink.set({
          sourceId: data.sourceId as string,
          articleNo: data.articleNo as string,
        });
        devLog('navigateFromNotification.exit', { result: true });
        return true;
      }

      // Fallback: server payload incomplete (e.g. dispatcher omits sourceId).
      // Open the notices tab anyway so the user lands somewhere meaningful
      // rather than getting silent no-op. Server fix tracked separately —
      // see plans/cuddly-foraging-comet.md Track 2.
      router.push('/(tabs)/notices');
      devLog('navigateFromNotification.exit', {
        result: true,
        fallback: 'tab-only',
        reason: 'missing-sourceId-or-articleNo',
        hasSourceId,
        hasArticleNo,
      });
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
