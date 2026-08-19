import {
  resolveNotificationTap,
  type NotificationTap,
  type NotificationTapData,
} from '@skkuverse/shared';
import { pendingExternalNoticeLink } from '@/lib/pending-external-notice-link';
import { pendingMiniAppLink } from '@/lib/pending-mini-app-link';
import { pendingSduiAction } from '@/lib/pending-sdui-action';
import { devLog } from '@/services/dev-log';

/**
 * The navigation-free half of notification handling: resolve a payload and
 * stash the intent.
 *
 * Split from `notification-router.ts` specifically so it imports no
 * `expo-router`. The notifee background handler is registered at module scope
 * in `index.ts` **before** `expo-router/entry`, and that file's header exists
 * because import order there has already broken quit-state delivery once. A
 * headless path that cannot navigate should not be dragging the navigator's
 * module graph in ahead of the entry point either.
 *
 * Every destination goes through a pending holder rather than navigating
 * inline, because a quit-state tap can resolve before the root navigator has a
 * key and a push against an unmounted navigator is silently lost. The consumers
 * in `app/_layout.tsx` drain them once navigation is ready — the same mechanism
 * `+native-intent.tsx` uses for a cold-start deep link.
 */

/** Re-exported so call sites keep one import for the payload shape. */
export type NotificationData = NotificationTapData;

/** Resolve with a diagnostic breadcrumb. Quit-state has no Metro console. */
export function resolveTap(data: NotificationData | undefined): NotificationTap {
  devLog('notificationTap.resolve', {
    type: data?.type ?? null,
    keys: data ? Object.keys(data) : null,
  });
  return resolveNotificationTap(data);
}

/** Perform an already-resolved tap. Returns true when a destination was stashed. */
export function applyTap(tap: NotificationTap): boolean {
  if (!tap) {
    devLog('notificationTap.exit', { result: false, reason: 'no-destination' });
    return false;
  }

  switch (tap.kind) {
    case 'notice':
      pendingExternalNoticeLink.set({
        sourceId: tap.sourceId,
        articleNo: tap.articleNo,
        source: 'push',
      });
      break;

    case 'miniapp':
      // PendingMiniAppLinkConsumer resolves the slug against GET /miniapps/:id
      // and drops it silently on a miss, so a stale id leaves the user where
      // they were rather than on an error screen.
      pendingMiniAppLink.set({ id: tap.id });
      break;

    case 'sdui-action':
      pendingSduiAction.set({ actionType: tap.actionType, actionValue: tap.actionValue });
      break;
  }

  devLog('notificationTap.exit', { result: true, kind: tap.kind });
  return true;
}

/**
 * Resolve the payload and stash the intent, touching no navigation API.
 * Safe to call before — or entirely without — a mounted React tree.
 */
export function stashNotificationTap(data: NotificationData | undefined): boolean {
  return applyTap(resolveTap(data));
}
