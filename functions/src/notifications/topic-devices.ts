import { getFirestore } from 'firebase-admin/firestore';
import type { DeviceDocument } from '../types.ts';

/**
 * The device lookup and dead-token cleanup shared by every topic-scoped send.
 *
 * Extracted when the mini-app handlers arrived rather than copied, because the
 * cleanup allowlist below is the part that must never be reasoned about twice —
 * see TOKEN_CLEANUP_CODES.
 *
 * `handle-notice.ts` predates this and still holds its own copy; it is pinned by
 * its own tests and deployed, so it is left alone deliberately rather than
 * refactored alongside a feature change.
 */

/**
 * Allowlist of FCM error codes that invalidate a token.
 *
 * messaging/invalid-argument is INTENTIONALLY EXCLUDED:
 * it fires on payload-wide problems (4KB+ body, reserved data key, bad TTL,
 * malformed notification object — not the token itself). Including it here
 * would mark every healthy device in a bad-payload batch as active:false in
 * one shot, a large-scale data-loss footgun with no recovery path.
 *
 * ALLOWLIST not denylist — unknown error codes fail closed (no cleanup),
 * so a future FCM error type won't auto-opt-in to destructive behavior.
 */
export const TOKEN_CLEANUP_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** FCM's own per-multicast ceiling, and the batch size for the cleanup writes. */
export const FCM_BATCH = 500;

export interface TopicDevice {
  docId: string;
  token: string;
  locale: 'ko' | 'en';
}

/**
 * Devices subscribed to any of `topics`.
 *
 * `array-contains-any` with a one-element array rather than `array-contains`,
 * so this reuses the exact composite index `handle-notice` already relies on
 * (`active`, `notificationsEnabled`, `subscribedTopics` in
 * apps/mobile/firestore.indexes.json). A different operator here would be a
 * second index to declare and to remember.
 *
 * `notificationsEnabled` gating is not redundant with the topic filter even
 * though `deriveSubscribedTopics` already returns [] when the master toggle is
 * off: it is the defence that still holds if a derive ever runs stale.
 */
export async function loadTopicDevices(topics: string[]): Promise<TopicDevice[]> {
  const snap = await getFirestore()
    .collection('devices')
    .where('active', '==', true)
    .where('notificationsEnabled', '==', true)
    .where('subscribedTopics', 'array-contains-any', topics)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data() as DeviceDocument;
    return {
      docId: doc.id,
      token: data.token,
      locale: data.locale === 'en' ? 'en' : 'ko',
    };
  });
}

/** Mark tokens FCM rejected as permanently dead. Returns how many were retired. */
export async function deactivateDevices(docIds: string[]): Promise<number> {
  if (docIds.length === 0) return 0;
  const db = getFirestore();
  let cleanedUp = 0;
  for (let i = 0; i < docIds.length; i += FCM_BATCH) {
    const chunk = docIds.slice(i, i + FCM_BATCH);
    const batch = db.batch();
    for (const docId of chunk) {
      batch.update(db.collection('devices').doc(docId), 'active', false);
    }
    await batch.commit();
    cleanedUp += chunk.length;
  }
  return cleanedUp;
}

/**
 * The mini-app topic namespace, defined ONCE.
 *
 * `deriveSubscribedTopics` writes these strings onto devices and
 * `loadTopicDevices` reads them back, so the two must agree exactly. They used
 * to spell the prefix out separately, which fails in the worst available way: a
 * changed prefix on one side means derive writes `miniappN:<id>`, the query
 * matches nothing, and the handler returns `{status: 200, sent: 0}`. The server
 * records a successful send, ops sees a 200, and nobody receives anything.
 */
export const MINIAPP_TOPIC_PREFIX = 'miniapp';

/** The topic a mini app broadcasts on. The caller never chooses this. */
export function miniAppTopic(miniAppId: string): string {
  return `${MINIAPP_TOPIC_PREFIX}:${miniAppId}`;
}
