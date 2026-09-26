/**
 * In-app games, host side: what a game screen knows about the run on screen,
 * when a crash is final, and whether its score goes on the board.
 *
 * Game-agnostic — any bundled game that speaks `@skkuverse/game-host` runs on
 * this. Pure: type-only imports, so it loads under `node --test` as is.
 * Firestore rules (`leaderboards/{gameId}/scores/{uid}` in firestore.rules)
 * decide for real; this is the same judgement made early.
 */
import type { GameMessage, GamePhase } from '@skkuverse/game-host';
import type { UserProfile } from '@/features/profile/domain';

export type GameOver = Omit<Extract<GameMessage, { type: 'game:over' }>, 'type'>;

/**
 * The run document (users/{uid}/gameRuns/{id}) the result would be entered
 * against, with the uid it was stamped under — an anonymous player who signs
 * in may come back as someone else.
 */
export interface ArmedRun {
  id: string;
  uid: string;
}

/**
 * The revive offer after a crash:
 * - `open`: counting down; the ad button works.
 * - `watching`: the ad is on screen; the countdown holds.
 * - `closed`: over (ran out, the ad earned nothing, or none left) — the crash
 *   is final, and the offer is shown spent.
 * - `unavailable`: no ad could play — the crash is final, and no offer is shown.
 * - `none`: no crash on screen.
 */
export type Offer = 'none' | 'open' | 'watching' | 'closed' | 'unavailable';

/** `rejected` (the rules, a missing run or email) and `otherAccount` are final; `network` can be retried. */
export type SubmitFailure = 'network' | 'rejected' | 'otherAccount';

export type Submission =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'submitted'; rank: number | null }
  | { status: 'notImproved' }
  | { status: 'failed'; reason: SubmitFailure };

export interface SessionState {
  phase: 'loading' | GamePhase;
  over: GameOver | null;
  run: ArmedRun | null;
  offer: Offer;
  submission: Submission;
}

export type SessionEvent =
  | { type: 'page'; message: GameMessage }
  | { type: 'runArmed'; run: ArmedRun }
  | { type: 'restart' }
  | { type: 'reviveStarted' }
  | { type: 'reviveFailed' }
  | { type: 'offerExpired' }
  | { type: 'offerUnavailable' }
  | { type: 'finalize' }
  // Submission events name their run: one that settles after a restart must
  // not land on the run that replaced it.
  | { type: 'submitStart'; runId: string }
  | { type: 'submitted'; runId: string; rank: number | null }
  | { type: 'notImproved'; runId: string }
  | { type: 'submitFailed'; runId: string; reason: SubmitFailure };

export function initialSession(): SessionState {
  return { phase: 'loading', over: null, run: null, offer: 'none', submission: { status: 'idle' } };
}

const close = (s: SessionState): SessionState =>
  s.offer === 'none' || s.offer === 'unavailable' ? s : { ...s, offer: 'closed' };

export function sessionReducer(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case 'page': {
      const m = e.message;
      switch (m.type) {
        case 'game:ready':
          // The page reloaded (its process can be killed while an ad is up).
          // A crash on screen is not lost with it: it becomes final.
          if (s.phase === 'crashed' && s.over) return close(s);
          return { ...s, phase: 'ready' };
        case 'game:phase':
          // Running again (a revive) retires the last result and its offer;
          // the next crash brings its own.
          return m.phase === 'running' ? { ...s, phase: m.phase, over: null, offer: 'none' } : { ...s, phase: m.phase };
        case 'game:over': {
          // A real second crash always passes through `running` first, which
          // clears `over`; a repeat of the same one must not reopen the offer.
          if (s.phase === 'crashed' && s.over) return s;
          const { type: _type, ...over } = m;
          return { ...s, phase: 'crashed', over, offer: over.revivesLeft > 0 ? 'open' : 'closed' };
        }
        default:
          return s;
      }
    }
    case 'runArmed':
      // The same run moved to another account (claimed after a sign-in that
      // changed the uid): whatever was decided for it under the old one no
      // longer holds.
      if (s.run?.id === e.run.id && s.run.uid !== e.run.uid) return { ...s, run: e.run, submission: { status: 'idle' } };
      return { ...s, run: e.run };
    case 'restart':
      // A crash still on screen goes back to the title with it: after a page
      // reload the page is already there and will not say so again.
      return {
        ...s,
        phase: s.phase === 'crashed' ? 'ready' : s.phase,
        over: null,
        run: null,
        offer: 'none',
        submission: { status: 'idle' },
      };
    case 'reviveStarted':
      return s.offer === 'open' ? { ...s, offer: 'watching' } : s;
    case 'reviveFailed':
      return s.offer === 'watching' ? { ...s, offer: 'closed' } : s;
    case 'offerExpired':
      return s.offer === 'open' ? { ...s, offer: 'closed' } : s;
    case 'offerUnavailable':
      return s.offer === 'open' ? { ...s, offer: 'unavailable' } : s;
    case 'finalize':
      return close(s);
    case 'submitStart':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'submitting' } } : s;
    case 'submitted':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'submitted', rank: e.rank } } : s;
    case 'notImproved':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'notImproved' } } : s;
    case 'submitFailed':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'failed', reason: e.reason } } : s;
  }
}

/** The crash can no longer be revived, so its score is what the run is worth. */
export function isFinal(s: SessionState): boolean {
  return s.phase === 'crashed' && s.over !== null && (s.offer === 'closed' || s.offer === 'unavailable');
}

export function canRevive(s: SessionState, adReady: boolean): boolean {
  return s.phase === 'crashed' && s.offer === 'open' && adReady;
}

// ── Getting a result on the board ────────────────────────────────────

export type SubmitDecision =
  | { kind: 'submit' }
  | { kind: 'noRun' }
  | { kind: 'notImproved' }
  | { kind: 'signIn' }
  | { kind: 'otherAccount' }
  | { kind: 'rejected' }
  | { kind: 'setup' };

/**
 * What a final crash does to the board, in the order a player meets the
 * gates: an @g.skku.edu Google account, the run stamped under that same
 * account, a profile with a campus and a nickname — and a score better than
 * the player's best already there, since a board keeps one line per player.
 * A score of 0 is no result in either order: a distance of nothing, or a time
 * no run can take.
 */
export function decideSubmit(input: {
  uid: string | null;
  isAnonymous: boolean;
  emailPrefix: string | null;
  run: ArmedRun | null;
  profile: UserProfile | null;
  score: number;
  /** The player's best on this board; null when they have none. */
  myBest: number | null;
  /**
   * `a` beats `b` on this game's board — leaderboard/domain `isBetter` with
   * the game's order. Passed in: a pure module here cannot import another's
   * values and still load under `node --test`.
   */
  better(a: number, b: number): boolean;
  /** The rules' absolute cap on this game's score (`maxEntryScore`). */
  maxEntry: number;
}): SubmitDecision {
  // No run means nobody was signed in, even anonymously, when it started;
  // signing in now would not stamp it, so there is nothing to offer.
  if (!input.run) return { kind: 'noRun' };
  if (input.score > input.maxEntry) return { kind: 'rejected' };
  if (input.score <= 0) return { kind: 'notImproved' };
  // Before the best: an anonymous player has no entry, whatever a stale best says.
  if (!input.uid || input.isAnonymous) return { kind: 'signIn' };
  if (input.run.uid !== input.uid) return { kind: 'otherAccount' };
  if (input.myBest !== null && !input.better(input.score, input.myBest)) return { kind: 'notImproved' };
  if (!input.emailPrefix) return { kind: 'rejected' };
  if (!input.profile?.nickname) return { kind: 'setup' };
  return { kind: 'submit' };
}

/**
 * Back from sign-in or the profile screen and still facing the same step:
 * the player backed out, so the flow stops rather than sending them again.
 */
export function isStalledOn(awaiting: 'signIn' | 'setup', decision: SubmitDecision): boolean {
  return decision.kind === awaiting;
}

/** The fields of a leaderboard entry, all but the server-stamped `updatedAt`. */
export function buildEntry(input: {
  uid: string;
  runId: string;
  over: GameOver;
  profile: UserProfile;
  emailPrefix: string;
}) {
  return {
    uid: input.uid,
    runId: input.runId,
    score: input.over.score,
    revives: input.over.revives,
    nickname: input.profile.nickname!,
    emailPrefix: input.emailPrefix,
    campus: input.profile.campus,
  };
}

export type EntryFields = ReturnType<typeof buildEntry>;
