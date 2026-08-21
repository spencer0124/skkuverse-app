import {
  getMessaging,
  type BatchResponse,
  type MulticastMessage,
} from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/logger';
import {
  deactivateDevices,
  FCM_BATCH,
  loadTopicDevices,
  miniAppTopic,
  TOKEN_CLEANUP_CODES,
} from './notifications/topic-devices.ts';
import type { DispatchResult } from './handle-notice.ts';
import type { EventMapRefreshPayload } from './types.ts';

/**
 * The silent correction lever: invalidate the cached event-map manifest on
 * devices, without the user ever seeing anything.
 *
 * Three things here are load-bearing and each fails differently if changed:
 *
 * 1. **No `notification` block, ever.** The OS would draw a banner for something
 *    the user was never meant to see, and the app badges on that block's
 *    presence — so adding one also leaves a badge with nothing behind it to
 *    clear. `apps/mobile/src/services/background-messaging.ts` is the other half
 *    of that rule.
 *
 * 2. **`apns-priority: 5`, not 10.** Apple REJECTS a background push sent at the
 *    higher priority, and the rejection is per-message — so getting this wrong
 *    disables the whole lever rather than degrading it.
 *
 * 3. **Scoped to `miniapp:<id>` like every other mini-app message.** A broadcast
 *    to every device would reach people who never subscribed, which is exactly
 *    the privilege escalation the forced topic exists to prevent. Non-subscribers
 *    converge on the next ordinary manifest poll, which is the real safety net
 *    underneath this one — see docs/explanation/eventmap-rendering.md §2 for how
 *    little this buys outside the foreground.
 */
export async function handleEventMapRefresh(
  body: EventMapRefreshPayload,
): Promise<DispatchResult> {
  const start = Date.now();

  if (typeof body.miniAppId !== 'string' || !body.miniAppId) {
    return { status: 400, body: { error: 'miniAppId is required' } };
  }

  const topic = miniAppTopic(body.miniAppId);
  const devices = await loadTopicDevices([topic]);

  if (devices.length === 0) {
    logger.info('eventmap.refresh.no_devices', { miniAppId: body.miniAppId, topic });
    return { status: 200, body: { sent: 0, failed: 0, cleanedUp: 0 } };
  }

  // No locale bucketing: nothing here is rendered, so there is nothing to
  // translate. `reason` is logged above and deliberately NOT sent — it is
  // operator context, and the data map is what an attacker would read off a
  // device.
  const data: Record<string, string> = {
    type: 'eventmap-refresh',
    miniAppId: body.miniAppId,
  };

  let sent = 0;
  let failed = 0;
  const cleanupIds: string[] = [];

  const messaging = getMessaging();
  for (let i = 0; i < devices.length; i += FCM_BATCH) {
    const chunk = devices.slice(i, i + FCM_BATCH);
    const message: MulticastMessage = {
      tokens: chunk.map((d) => d.token),
      data,
      android: { priority: 'high' },
      apns: {
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
        },
        payload: { aps: { 'content-available': 1 } },
      },
      fcmOptions: { analyticsLabel: 'eventmap_refresh_v1' },
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

  const cleanedUp = await deactivateDevices(cleanupIds);

  logger.info('eventmap.refresh.complete', {
    miniAppId: body.miniAppId,
    topic,
    reason: body.reason ?? null,
    deviceCount: devices.length,
    sent,
    failed,
    cleanedUp,
    durationMs: Date.now() - start,
  });

  return { status: 200, body: { sent, failed, cleanedUp } };
}
