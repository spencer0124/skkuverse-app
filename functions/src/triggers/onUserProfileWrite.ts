import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/logger';
import { entryProjection, isLeaderboardEntryPath, needsRewrite, projectionChanged } from '../games/profileProjection.ts';

const REGION = 'asia-northeast3';
const BATCH_LIMIT = 500;

/** An event older than this is left to the next profile change rather than retried forever. */
const MAX_EVENT_AGE_MS = 10 * 60 * 1000;

/**
 * Firestore onWrite trigger: users/{uid}
 *
 * A leaderboard entry (leaderboards/{gameId}/scores/{uid}, the player's best
 * on that board) copies their nickname and campus so a board is one query
 * rather than a read per row. When the profile changes, this rewrites those
 * copies on the player's entry in every game, so the boards show who they are
 * now. Clients can only raise their score; this runs as admin.
 *
 * Triggers arrive unordered and possibly twice, so the event only says "look
 * again": the projection written is re-read from users/{uid} now, and only
 * entries that differ are touched. That makes a retry safe, so retry is on,
 * bounded by the event's age. It writes only to scores, never back to
 * users/{uid}, so it cannot loop.
 */
export const onUserProfileWrite = onDocumentWritten(
  { document: 'users/{uid}', region: REGION, retry: true },
  async (event) => {
    if (Date.now() - Date.parse(event.time) > MAX_EVENT_AGE_MS) return;
    const uid = event.params.uid;
    if (!projectionChanged(event.data?.before.data(), event.data?.after.data())) return;

    const db = getFirestore();
    const projection = entryProjection((await db.doc(`users/${uid}`).get()).data());
    if (!projection) return;

    const entries = await db.collectionGroup('scores').where('uid', '==', uid).get();
    const stale = entries.docs.filter((d) => isLeaderboardEntryPath(d.ref.path) && needsRewrite(d.data(), projection));
    for (let i = 0; i < stale.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const doc of stale.slice(i, i + BATCH_LIMIT)) batch.update(doc.ref, { ...projection });
      await batch.commit();
    }
    logger.info('leaderboard entries follow profile', { uid, rewritten: stale.length });
  },
);
