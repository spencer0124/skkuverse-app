import { getApp } from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { primeAppCheck } from '@/services/app-check-prime';
import type { NativeGameId } from '../ids';

/**
 * Run stamps: `users/{uid}/gameRuns/{runId}` in firestore.rules. The server's
 * clock on this write is what bounds a score on the leaderboard later.
 */

/**
 * Each stamp's write, by run id. An entry waits for its run's stamp: the stamp
 * waits on App Check priming first, so without this an entry sent right after
 * a short run could overtake it and be refused for citing a run that does not
 * exist yet.
 */
const runWrites = new Map<string, Promise<void>>();

/**
 * Stamp a run and return its id straight away. The host sends it before the
 * run begins (GameScreen `arm`), so the clock can only start early.
 */
export function startRun(uid: string, gameId: NativeGameId, onError: (e: unknown) => void): string {
  const ref = firestore().collection('users').doc(uid).collection('gameRuns').doc();
  const written = primeAppCheck().then(() => ref.set({ gameId, startedAt: firestore.FieldValue.serverTimestamp() }));
  runWrites.set(ref.id, written);
  written.catch((err) => {
    // Forget a stamp that failed: an entry citing it is then refused by the
    // rules (final), instead of every retry awaiting the same rejection.
    runWrites.delete(ref.id);
    onError(err);
  });
  return ref.id;
}

/** Resolves once the run's stamp has been written (or failed); never rejects. */
export function runStamped(runId: string): Promise<void> {
  return runWrites.get(runId)?.catch(() => undefined) ?? Promise.resolve();
}

/**
 * Move a run stamped under the anonymous account to the account just signed
 * into (the `claimRun` callable). Needed when sign-in changed the uid — an
 * account that signed in before cannot absorb the anonymous one — or the run
 * could never go on the board. The server copies the stamp's time unchanged.
 */
export async function claimRun(anonIdToken: string, runId: string): Promise<void> {
  const callable = httpsCallable<{ anonIdToken: string; runId: string }, { ok: true }>(
    getFunctions(getApp(), 'asia-northeast3'),
    'claimRun',
  );
  await callable({ anonIdToken, runId });
}
