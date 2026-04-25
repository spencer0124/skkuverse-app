import { getFirestore } from 'firebase-admin/firestore';
import {
  getMessaging,
  type BatchResponse,
  type MulticastMessage,
} from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/logger';
import { mapCategoryToChannel } from './channels';
import type { DeviceDocument, NoticeNotificationPayload } from './types';

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
const TOKEN_CLEANUP_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const MAX_TOPICS = 10;
const FCM_BATCH = 500;

type LocaleGroup = { docId: string; token: string };

export interface DispatchResult {
  status: number;
  body: unknown;
}

export async function handleNoticeNotification(
  body: NoticeNotificationPayload,
): Promise<DispatchResult> {
  const start = Date.now();

  if (!Array.isArray(body.topics) || body.topics.length === 0) {
    return { status: 400, body: { error: 'topics must be a non-empty string[]' } };
  }
  if (body.topics.length > MAX_TOPICS) {
    return {
      status: 400,
      body: { error: `topics length > ${MAX_TOPICS} (MVP conservative limit)` },
    };
  }
  if (!body.title_ko || !body.body_ko) {
    return { status: 400, body: { error: 'title_ko and body_ko are required' } };
  }
  if (typeof body.noticeId !== 'string' || !body.noticeId) {
    return { status: 400, body: { error: 'noticeId is required' } };
  }

  const db = getFirestore();
  const devicesSnap = await db
    .collection('devices')
    .where('active', '==', true)
    .where('notificationsEnabled', '==', true)
    .where('subscribedTopics', 'array-contains-any', body.topics)
    .get();

  if (devicesSnap.empty) {
    logger.info('notice.dispatch.no_devices', {
      noticeId: body.noticeId,
      topics: body.topics,
    });
    return { status: 200, body: { sent: 0, failed: 0, cleanedUp: 0 } };
  }

  const groups: Record<'ko' | 'en', LocaleGroup[]> = { ko: [], en: [] };
  for (const doc of devicesSnap.docs) {
    const data = doc.data() as DeviceDocument;
    const locale: 'ko' | 'en' = data.locale === 'en' ? 'en' : 'ko';
    groups[locale].push({ docId: doc.id, token: data.token });
  }

  // FCM v1 requires all `data` values to be strings at runtime validation.
  // Optional fields are excluded when undefined to avoid SDK rejection.
  const data: Record<string, string> = {
    type: body.type,
    noticeId: body.noticeId,
  };
  if (body.sourceId) data.sourceId = body.sourceId;
  if (body.articleNo) data.articleNo = body.articleNo;
  if (body.category) data.category = body.category;

  const channelId = mapCategoryToChannel(body.category);
  // Guard against `notice_undefined_v1` when category is omitted.
  const analyticsLabel = `notice_${body.category ?? 'general'}_v1`;

  let sent = 0;
  let failed = 0;
  const cleanupIds: string[] = [];

  const messaging = getMessaging();
  for (const localeKey of ['ko', 'en'] as const) {
    const group = groups[localeKey];
    if (group.length === 0) continue;

    const title =
      localeKey === 'en' ? body.title_en ?? body.title_ko : body.title_ko;
    const bodyText =
      localeKey === 'en' ? body.body_en ?? body.body_ko : body.body_ko;

    for (let i = 0; i < group.length; i += FCM_BATCH) {
      const chunk = group.slice(i, i + FCM_BATCH);
      const message: MulticastMessage = {
        tokens: chunk.map((g) => g.token),
        notification: { title, body: bodyText },
        data,
        android: {
          priority: 'high',
          notification: { channelId },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
        fcmOptions: { analyticsLabel },
      };

      const resp: BatchResponse = await messaging.sendEachForMulticast(message);
      sent += resp.successCount;
      failed += resp.failureCount;

      resp.responses.forEach((r, idx) => {
        if (!r.success && r.error && TOKEN_CLEANUP_CODES.has(r.error.code)) {
          cleanupIds.push(chunk[idx].docId);
        }
      });
    }
  }

  let cleanedUp = 0;
  for (let i = 0; i < cleanupIds.length; i += FCM_BATCH) {
    const chunk = cleanupIds.slice(i, i + FCM_BATCH);
    const batch = db.batch();
    for (const docId of chunk) {
      batch.update(db.collection('devices').doc(docId), 'active', false);
    }
    await batch.commit();
    cleanedUp += chunk.length;
  }

  logger.info('notice.dispatch.complete', {
    noticeId: body.noticeId,
    topics: body.topics,
    deviceCount: devicesSnap.size,
    sent,
    failed,
    cleanedUp,
    durationMs: Date.now() - start,
  });

  return { status: 200, body: { sent, failed, cleanedUp } };
}
