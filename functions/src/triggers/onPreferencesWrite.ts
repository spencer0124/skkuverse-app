import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/logger';
import { deriveSubscribedTopics } from '../notifications/derive.ts';
import { intentChanged, setEquals } from '../utils/equality.ts';
import type { PreferencesDocument } from '../types.ts';

const REGION = 'asia-northeast3';

/**
 * Firestore onWrite trigger: users/{uid}/preferences/main
 *
 * Computes the derived `subscribedTopics` from the user's intent fields
 * (`enabled`, `categoryEnabled`, `pickerSelections`) and writes it back
 * atomically with `derivedAt` timestamp. This is the SSOT redesign's
 * server-side derivation step (v5.1) — clients write only intent, the
 * server is the single source of truth for what FCM topics fan out.
 *
 * Two self-loop guards prevent infinite trigger recursion:
 *
 *   Guard 1 — intent unchanged: bookmark for "this is my own write coming
 *     back". When derive() updates subscribedTopics + derivedAt, the only
 *     fields changed in this trigger's after-vs-before are derived ones;
 *     intent fields are bit-identical, so Guard 1 short-circuits.
 *
 *   Guard 2 — derive == current: idempotency safety net. Even if intent
 *     changed but the result of derive() matches the existing
 *     subscribedTopics array (set equality), skip the write. Saves one
 *     unnecessary write + downstream sync-preferences-to-devices trigger.
 *
 * retry: false — intent-change loss is acceptable. The next user write
 * (toggle, picker confirm) will re-trigger derive. Retrying ancient events
 * could re-derive against stale intent state.
 */
export const onPreferencesWrite = onDocumentWritten(
  {
    document: 'users/{uid}/preferences/main',
    region: REGION,
    retry: false,
  },
  async (event) => {
    const uid = event.params.uid;
    const change = event.data;
    if (!change?.after.exists) {
      logger.debug('preferences doc deleted or missing; skip', { uid });
      return;
    }

    const afterData = change.after.data() as PreferencesDocument;
    const beforeData = change.before.exists
      ? (change.before.data() as PreferencesDocument)
      : undefined;

    // Guard 1: intent 변경 없으면 즉시 return (self-loop 방지).
    // 우리가 subscribedTopics + derivedAt 쓴 직후의 trigger는 여기서 빠짐.
    // 비교 자체는 utils/equality.ts의 intentChanged — 새 intent 필드를 빠뜨리는
    // 실수가 조용히 나중에 터지는 종류라, 단위 테스트가 가능한 자리에 둔다.
    if (!intentChanged(beforeData, afterData)) {
      logger.debug('intent unchanged; skip', { uid });
      return;
    }

    // Guard 2: derive 결과 == 현재값 → write skip (idempotency).
    const derived = deriveSubscribedTopics(
      { ...afterData, noticeTabEnabled: afterData.noticeTabEnabled ?? {} },
      { uid },
    );
    if (setEquals(derived, afterData.subscribedTopics ?? [])) {
      logger.debug('derived topics unchanged; skip write', {
        uid,
        topicCount: derived.length,
      });
      return;
    }

    // Race-tolerant update: a concurrent admin-SDK delete (deleteAccount CF
    // path) can remove the doc between the existence check above and this
    // write. NOT_FOUND in that window is a no-op — the derived fields are
    // dead anyway. Other update errors still surface.
    try {
      await change.after.ref.update({
        subscribedTopics: derived,
        derivedAt: FieldValue.serverTimestamp(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: number | string })?.code;
      // Firestore Admin SDK throws gRPC code 5 (NOT_FOUND) here.
      if (code === 5 || code === 'not-found') {
        logger.info('preferences doc concurrently deleted; skip derive write', {
          uid,
        });
        return;
      }
      throw err;
    }

    logger.info('notifications.derive.written', {
      uid,
      topicCount: derived.length,
      enabled: afterData.enabled,
      categoryEnabled: afterData.categoryEnabled,
    });
  },
);
