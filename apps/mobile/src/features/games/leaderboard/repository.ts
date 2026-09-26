import firestore from '@react-native-firebase/firestore';
import { primeAppCheck } from '@/services/app-check-prime';
import type { EntryFields } from '../host/domain';
import type { NativeGameId } from '../ids';
import { rankFromCount, type BoardEntry, type ScoreOrder } from './domain';

/**
 * `leaderboards/{gameId}/scores/{uid}` — one entry per player, their best.
 * Rules: the "In-app games" section of firestore.rules.
 */
const scores = (gameId: NativeGameId) => firestore().collection('leaderboards').doc(gameId).collection('scores');

function toBoardEntry(d: Record<string, unknown> | undefined, uid: string): BoardEntry | null {
  if (!d || typeof d.score !== 'number' || typeof d.nickname !== 'string') return null;
  return {
    uid,
    nickname: d.nickname,
    emailPrefix: typeof d.emailPrefix === 'string' ? d.emailPrefix : '',
    campus: d.campus === 'nsc' ? 'nsc' : 'hssc',
    score: d.score,
  };
}

/** The best `limit` entries, best first: highest for `desc`, lowest (fastest) for `asc`. */
export async function topEntries(gameId: NativeGameId, order: ScoreOrder, limit: number): Promise<BoardEntry[]> {
  const snap = await scores(gameId).orderBy('score', order).limit(limit).get();
  return snap.docs.map((doc) => toBoardEntry(doc.data(), doc.id)).filter((e): e is BoardEntry => e !== null);
}

/** The player's own entry, from the server: a cached copy could be an older best. */
export async function myEntry(gameId: NativeGameId, uid: string): Promise<BoardEntry | null> {
  const snap = await scores(gameId).doc(uid).get({ source: 'server' });
  return toBoardEntry(snap.data(), uid);
}

/** Where a score would rank: entries strictly better, plus one. */
export async function rankOf(gameId: NativeGameId, order: ScoreOrder, score: number): Promise<number> {
  const snap = await scores(gameId)
    .where('score', order === 'desc' ? '>' : '<', score)
    .count()
    .get();
  return rankFromCount(snap.data().count);
}

/**
 * Write the player's new best. The rules take it only when it beats the one
 * already there (`isImprovement`), cites a fresh run, and matches the profile.
 */
export async function writeBest(gameId: NativeGameId, entry: EntryFields): Promise<void> {
  await primeAppCheck();
  await scores(gameId)
    .doc(entry.uid)
    .set({ ...entry, updatedAt: firestore.FieldValue.serverTimestamp() });
}
