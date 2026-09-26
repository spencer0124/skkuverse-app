/**
 * Moving a run stamp from the anonymous account a game was played on to the
 * Google account the player then signed in as. An account that signed in
 * before cannot absorb the anonymous one (Firebase refuses the link), so the
 * uid changes at sign-in and the stamp is left behind under the old one; the
 * leaderboard rules only accept a run under the caller's own uid.
 *
 * The copy keeps `startedAt` exactly — that stamp is what bounds the score —
 * so moving a run grants nothing a run under the new uid could not have had.
 */
/** Mirror of `isGameId` in apps/mobile/firestore.rules. */
export const GAME_IDS: readonly string[] = ['wave-run', 'subway-typing'];
/** Same window the rules give a run (`isEarnedOnRun`). */
export const RUN_WINDOW_MS = 60 * 60 * 1000;

export interface RunDoc {
  gameId: string;
  startedAt: Date;
}

export type ClaimDecision =
  | { kind: 'copy'; data: RunDoc }
  | { kind: 'already' }
  | { kind: 'refuse'; reason: 'not-skku' | 'not-anonymous' | 'same-account' | 'no-run' | 'expired' };

export function decideClaim(input: {
  callerUid: string;
  callerIsSkkuGoogle: boolean;
  /** The account the run was stamped under, as its verified ID token says. */
  from: { uid: string; provider: string };
  run: RunDoc | null;
  /** A run of that id is already under the caller. */
  existing: boolean;
  now: number;
}): ClaimDecision {
  if (!input.callerIsSkkuGoogle) return { kind: 'refuse', reason: 'not-skku' };
  if (input.from.provider !== 'anonymous') return { kind: 'refuse', reason: 'not-anonymous' };
  if (input.from.uid === input.callerUid) return { kind: 'refuse', reason: 'same-account' };
  const run = input.run;
  if (!run || !GAME_IDS.includes(run.gameId)) return { kind: 'refuse', reason: 'no-run' };
  if (input.now - run.startedAt.getTime() >= RUN_WINDOW_MS) return { kind: 'refuse', reason: 'expired' };
  if (input.existing) return { kind: 'already' };
  return { kind: 'copy', data: { gameId: run.gameId, startedAt: run.startedAt } };
}

/** The rules' `isSkkuGoogle`, on a decoded ID token. */
export function isSkkuGoogleToken(token: Record<string, unknown> | undefined): boolean {
  if (!token) return false;
  const email = token.email;
  const firebase = token.firebase as { identities?: Record<string, unknown> } | undefined;
  return (
    typeof email === 'string' &&
    /^[a-z0-9._-]+@g[.]skku[.]edu$/.test(email) &&
    token.email_verified === true &&
    !!firebase?.identities &&
    'google.com' in firebase.identities
  );
}
