import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { decideClaim, isSkkuGoogleToken } from './games/claimRun.ts';

const REGION = 'asia-northeast3';

interface ClaimRunInput {
  /** An ID token of the anonymous account the run was played on, taken before sign-in. */
  anonIdToken: string;
  runId: string;
}

/**
 * Callable: move a game run stamp from the anonymous account it was played on
 * to the signed-in caller, so the run can still go on the leaderboard after a
 * sign-in that changed the uid. Holding a valid ID token of that anonymous
 * account is the proof of ownership; the stamp's time is copied unchanged.
 */
export const claimRun = onCall({ region: REGION, enforceAppCheck: true, maxInstances: 10 }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'sign-in required');
  const input = request.data as Partial<ClaimRunInput> | undefined;
  if (typeof input?.anonIdToken !== 'string' || typeof input.runId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(input.runId)) {
    throw new HttpsError('invalid-argument', 'anonIdToken and runId required');
  }

  let from: { uid: string; provider: string };
  try {
    const decoded = await getAuth().verifyIdToken(input.anonIdToken);
    from = { uid: decoded.uid, provider: decoded.firebase?.sign_in_provider ?? '' };
  } catch {
    throw new HttpsError('permission-denied', 'bad-token');
  }

  const db = getFirestore();
  const source = await db.doc(`users/${from.uid}/gameRuns/${input.runId}`).get();
  const target = db.doc(`users/${callerUid}/gameRuns/${input.runId}`);
  const data = source.data();
  const decision = decideClaim({
    callerUid,
    callerIsSkkuGoogle: isSkkuGoogleToken(request.auth?.token as Record<string, unknown> | undefined),
    from,
    run:
      data && typeof data.gameId === 'string' && data.startedAt instanceof Timestamp
        ? { gameId: data.gameId, startedAt: data.startedAt.toDate() }
        : null,
    existing: (await target.get()).exists,
    now: Date.now(),
  });

  if (decision.kind === 'refuse') {
    logger.info('claimRun refused', { reason: decision.reason });
    throw new HttpsError('failed-precondition', decision.reason);
  }
  if (decision.kind === 'copy') {
    try {
      await target.create({ gameId: decision.data.gameId, startedAt: Timestamp.fromDate(decision.data.startedAt) });
    } catch (err) {
      // A second claim of the same run racing this one got there first: the
      // run is where it should be either way.
      if ((err as { code?: number }).code !== 6 /* ALREADY_EXISTS */) throw err;
    }
  }
  return { ok: true };
});
