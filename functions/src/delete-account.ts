import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const REGION = 'asia-northeast3';

const REASON_ENUM = new Set([
  'not_used',
  'too_many_notifs',
  'no_value',
  'bugs',
  'other',
]);

const OTHER_TEXT_MAX = 500;
const BATCH_LIMIT = 500;

type DeleteAccountInput = {
  feedback?: {
    reasons?: unknown;
    otherText?: unknown;
  };
};

type ValidatedFeedback = {
  reasons: string[];
  otherText: string | null;
};

/**
 * Callable: deletes the caller's Firebase Auth user and all owned Firestore
 * data. Admin SDK bypasses both Firestore Rules (preferences/devices are
 * client-delete-blocked) and Auth recency requirements (no need to re-prompt
 * Google sign-in).
 *
 * Ordering:
 *   1. (optional) anonymous deletion feedback recorded — uid NOT stored
 *   2. recursive delete users/{uid}/bookmarks
 *   3. delete users/{uid}/preferences/main
 *   4. delete users/{uid}
 *   5. devices.where(uid==caller, active==true) → batched `active:false`
 *      with token/topics wipe. Soft-deactivate preserves "inactive doc is
 *      claimable" semantics for device recycling.
 *   6. auth.deleteUser(uid) — LAST. If a Firestore step fails, the auth
 *      record stays alive and the user can retry (idempotent).
 */
export const deleteAccount = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: false,
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'sign-in required');
    }

    const provider = request.auth?.token?.firebase?.sign_in_provider;
    if (provider === 'anonymous') {
      throw new HttpsError(
        'failed-precondition',
        'anonymous_cannot_delete',
      );
    }

    const feedback = validateFeedback(request.data as DeleteAccountInput);

    const startMs = Date.now();
    const db = getFirestore();
    const auth = getAuth();

    let bookmarksDeleted = 0;
    let devicesDeactivated = 0;

    // 1) Record feedback anonymously (no uid, no IP). Done first so a CF
    //    timeout mid-Firestore-cleanup still preserves the survey signal.
    if (feedback) {
      await db.collection('account_deletion_feedback').add({
        reasons: feedback.reasons,
        otherText: feedback.otherText,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // 2) Bookmarks subcollection — recursiveDelete handles paginated bulk
    //    via BulkWriter. Idempotent on missing/empty paths.
    const bookmarksRef = db.collection(`users/${uid}/bookmarks`);
    const bookmarksCount = await countDocs(bookmarksRef);
    if (bookmarksCount > 0) {
      await db.recursiveDelete(bookmarksRef);
      bookmarksDeleted = bookmarksCount;
    }

    // 3) Preferences doc.
    await db.doc(`users/${uid}/preferences/main`).delete();

    // 4) User parent doc.
    await db.doc(`users/${uid}`).delete();

    // 5) Devices owned by this uid → soft-deactivate. Whitelist update so we
    //    do not clobber per-device fields (deviceId, platform, lastActive)
    //    that other paths still read for debug / device-recycling claims.
    const devicesSnap = await db
      .collection('devices')
      .where('uid', '==', uid)
      .where('active', '==', true)
      .get();

    for (let i = 0; i < devicesSnap.docs.length; i += BATCH_LIMIT) {
      const chunk = devicesSnap.docs.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.update(doc.ref, {
          active: false,
          token: '',
          subscribedTopics: [],
          notificationsEnabled: false,
        });
      }
      await batch.commit();
    }
    devicesDeactivated = devicesSnap.size;

    // 6) Auth user deletion — last. Idempotent: user-not-found is success.
    try {
      await auth.deleteUser(uid);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/user-not-found') {
        logger.info('account.delete.idempotent', { uid });
      } else {
        logger.error('account.delete.auth_failed', {
          uid,
          code,
          err: String(err),
        });
        throw new HttpsError('internal', 'auth_delete_failed');
      }
    }

    logger.info('account.delete.complete', {
      uid,
      bookmarksDeleted,
      devicesDeactivated,
      hadFeedback: feedback !== null,
      durationMs: Date.now() - startMs,
    });

    return { ok: true as const };
  },
);

function validateFeedback(
  input: DeleteAccountInput | undefined,
): ValidatedFeedback | null {
  const fb = input?.feedback;
  if (fb === undefined || fb === null) return null;

  if (typeof fb !== 'object' || Array.isArray(fb)) {
    throw new HttpsError('invalid-argument', 'feedback_must_be_object');
  }

  const reasonsRaw = fb.reasons;
  if (!Array.isArray(reasonsRaw)) {
    throw new HttpsError('invalid-argument', 'reasons_must_be_array');
  }
  const reasons: string[] = [];
  for (const r of reasonsRaw) {
    if (typeof r !== 'string' || !REASON_ENUM.has(r)) {
      throw new HttpsError('invalid-argument', 'reason_not_in_enum');
    }
    if (!reasons.includes(r)) reasons.push(r);
  }

  let otherText: string | null = null;
  if (fb.otherText !== undefined && fb.otherText !== null) {
    if (typeof fb.otherText !== 'string') {
      throw new HttpsError('invalid-argument', 'otherText_must_be_string');
    }
    const trimmed = fb.otherText.trim();
    if (trimmed.length > OTHER_TEXT_MAX) {
      throw new HttpsError('invalid-argument', 'otherText_too_long');
    }
    if (trimmed.length > 0) otherText = trimmed;
  }

  if (reasons.length === 0 && otherText === null) return null;

  return { reasons, otherText };
}

async function countDocs(
  ref: FirebaseFirestore.CollectionReference,
): Promise<number> {
  const snap = await ref.count().get();
  return snap.data().count;
}
