import {
  getMessaging,
  type BatchResponse,
  type MulticastMessage,
} from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/logger';
import { mapTypeToChannel } from './channels.ts';
import {
  deactivateDevices,
  FCM_BATCH,
  loadTopicDevices,
  miniAppTopic,
  TOKEN_CLEANUP_CODES,
  type TopicDevice,
} from './notifications/topic-devices.ts';
import type { DispatchResult } from './handle-notice.ts';
import type { MiniAppNotificationPayload } from './types.ts';

/**
 * A mini app announces something to its subscribers.
 *
 * Mirrors handle-notice.ts — locale bucketing, a flat Record<string,string>
 * data map, 500-token multicast batches, dead-token cleanup — with one
 * structural difference that is the whole security point of this path:
 *
 *   **The caller does not choose the topic.** There is no `topics` field on the
 *   payload to honour. The topic is derived from `miniAppId`, which the server
 *   takes from the authenticated route rather than from the request body. A
 *   notice caller passes topics because the crawler already knows which boards a
 *   notice hit; a mini-app caller is the thing being constrained.
 *
 * Contract: docs/reference/miniapp-notification-payload.md (Surfaces 1 and 2).
 */
export async function handleMiniAppNotification(
  body: MiniAppNotificationPayload,
): Promise<DispatchResult> {
  const start = Date.now();

  if (typeof body.miniAppId !== 'string' || !body.miniAppId) {
    return { status: 400, body: { error: 'miniAppId is required' } };
  }
  // Required so that "the feed and the delivery cannot diverge" is checkable
  // after the fact rather than merely intended: the send path writes the feed
  // entry, then calls here with its id.
  if (typeof body.notificationId !== 'string' || !body.notificationId) {
    return { status: 400, body: { error: 'notificationId is required' } };
  }
  if (!body.title_ko || !body.body_ko) {
    return { status: 400, body: { error: 'title_ko and body_ko are required' } };
  }

  const topic = miniAppTopic(body.miniAppId);
  const devices = await loadTopicDevices([topic]);

  if (devices.length === 0) {
    logger.info('miniapp.dispatch.no_devices', {
      miniAppId: body.miniAppId,
      notificationId: body.notificationId,
      topic,
    });
    return { status: 200, body: { sent: 0, failed: 0, cleanedUp: 0 } };
  }

  const groups: Record<'ko' | 'en', TopicDevice[]> = { ko: [], en: [] };
  for (const device of devices) groups[device.locale].push(device);

  // FCM v1 validates every `data` value as a string at runtime. Absent optional
  // fields are omitted rather than sent empty, matching handle-notice.
  const data: Record<string, string> = {
    type: 'miniapp',
    miniAppId: body.miniAppId,
    notificationId: body.notificationId,
  };
  if (body.actionType) data.actionType = body.actionType;
  if (body.actionValue) data.actionValue = body.actionValue;

  const channelId = mapTypeToChannel('miniapp');

  let sent = 0;
  let failed = 0;
  const cleanupIds: string[] = [];

  const messaging = getMessaging();
  for (const localeKey of ['ko', 'en'] as const) {
    const group = groups[localeKey];
    if (group.length === 0) continue;

    // The ?? fallback is what lets a Korean-only sender need no extra handling.
    const title = localeKey === 'en' ? body.title_en ?? body.title_ko : body.title_ko;
    const bodyText = localeKey === 'en' ? body.body_en ?? body.body_ko : body.body_ko;

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
        fcmOptions: { analyticsLabel: 'miniapp_v1' },
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

  const cleanedUp = await deactivateDevices(cleanupIds);

  // Keyed on notificationId so `jsonPayload.notificationId="..."` in Cloud
  // Logging traces one delivery, and so the feed entry and the dispatch can be
  // reconciled after the fact.
  logger.info('miniapp.dispatch.complete', {
    miniAppId: body.miniAppId,
    notificationId: body.notificationId,
    topic,
    deviceCount: devices.length,
    sent,
    failed,
    cleanedUp,
    durationMs: Date.now() - start,
  });

  return { status: 200, body: { sent, failed, cleanedUp } };
}
