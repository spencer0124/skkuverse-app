import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { useAuthStore } from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';
import { classifyAndRestoreOnboarding, signInWithDeviceMigration } from '@/services/auth-flow';
import { GoogleAuthError } from '@/services/google-auth';
import { emailPrefixOf } from '@/features/profile/domain';
import { getProfile } from '@/features/profile/repository';
import type { ProfileState } from '@/features/profile/useUserProfile';
import type { NativeGameId } from '../ids';
import { isBetter } from '../leaderboard/domain';
import { myEntry, rankOf, writeBest } from '../leaderboard/repository';
import { NATIVE_GAMES } from '../registry';
import { useInvalidateLeaderboard, useMyBest } from '../leaderboard/useLeaderboard';
import { buildEntry, decideSubmit, isFinal, isStalledOn, type SessionEvent, type SessionState, type SubmitDecision } from './domain';
import { claimRun, runStamped } from './repository';

/** A write the server has not answered in this long is reported as a network failure. */
const SUBMIT_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

const isPermissionDenied = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === 'firestore/permission-denied';

/**
 * Puts a final run on the board by itself. A signed-in player with a nickname
 * needs to do nothing: the moment the run is final (the revive offer ran out,
 * or they tapped "next") a new personal best is written, and the board
 * animates them into place. Otherwise the screen asks once, after "next":
 * `signIn` signs in right there, and `pickNickname` opens the profile screen;
 * coming back resumes once, and coming back to the same step means they
 * backed out.
 */
export function useAutoSubmit(input: {
  gameId: NativeGameId;
  session: SessionState;
  dispatch: Dispatch<SessionEvent>;
  profile: ProfileState;
}) {
  const { gameId, session, dispatch, profile } = input;
  const router = useRouter();
  const isFocused = useIsFocused();
  const invalidate = useInvalidateLeaderboard(gameId);
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const email = useAuthStore((s) => s.email);
  const signedIn = !!uid && !isAnonymous;
  const myBest = useMyBest(gameId, signedIn ? uid : null);
  const { order, maxEntry } = NATIVE_GAMES[gameId].score;

  const attempted = useRef(new Set<string>());
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // True while a sign-in (and the claim that may follow it) is in flight: the
  // uid changes before the run has moved, and deciding in between would call
  // the run someone else's.
  const [signingIn, setSigningIn] = useState(false);
  /**
   * The last detour (sign-in, nickname) and where it sent the player, so the
   * screen can move on once they are back — and tell "backed out" (still
   * facing that same step) from "not decided yet".
   */
  const [detour, setDetour] = useState<{ state: 'none' | 'away' | 'back'; step: 'signIn' | 'setup' | null }>({
    state: 'none',
    step: null,
  });
  const [awaiting, setAwaiting] = useState<'signIn' | 'setup' | null>(null);
  const leftRef = useRef(false);

  const decide = useCallback(
    (s: SessionState): SubmitDecision =>
      decideSubmit({
        uid,
        isAnonymous,
        emailPrefix: emailPrefixOf(email),
        run: s.run,
        profile: profile.status === 'ready' ? profile.profile : null,
        score: s.over?.score ?? 0,
        myBest: myBest.data?.entry.score ?? null,
        better: (a, b) => isBetter(order, a, b),
        maxEntry,
      }),
    [uid, isAnonymous, email, profile, myBest.data, order, maxEntry],
  );

  /** Carry out a decision for the session as it was when it became final. */
  const act = useCallback(
    async (s: SessionState, d: SubmitDecision) => {
      const run = s.run;
      if (!run || !s.over) return;
      switch (d.kind) {
        case 'notImproved':
          dispatch({ type: 'notImproved', runId: run.id });
          return;
        case 'otherAccount':
        case 'rejected':
          dispatch({ type: 'submitFailed', runId: run.id, reason: d.kind });
          return;
        case 'signIn':
        case 'setup':
        case 'noRun':
          return; // The result screen shows the prompt; nothing to write yet.
        case 'submit': {
          if (profile.status !== 'ready' || !profile.profile || attempted.current.has(run.id)) return;
          attempted.current.add(run.id);
          const entry = buildEntry({ uid: uid!, runId: run.id, over: s.over, profile: profile.profile, emailPrefix: emailPrefixOf(email)! });
          dispatch({ type: 'submitStart', runId: run.id });
          try {
            await withTimeout(
              runStamped(run.id).then(() => writeBest(gameId, entry)),
              SUBMIT_TIMEOUT_MS,
            );
          } catch (err) {
            logHandledError('games/submit', err);
            if (!isPermissionDenied(err)) {
              attempted.current.delete(run.id);
              dispatch({ type: 'submitFailed', runId: run.id, reason: 'network' });
              return;
            }
            // Refused: most often a best set on another device that this one
            // had not seen. Say so when that is it.
            const current = await myEntry(gameId, entry.uid).catch(() => null);
            dispatch(
              current && !isBetter(order, entry.score, current.score)
                ? { type: 'notImproved', runId: run.id }
                : { type: 'submitFailed', runId: run.id, reason: 'rejected' },
            );
            void invalidate();
            return;
          }
          const rank = await rankOf(gameId, order, entry.score).catch(() => null);
          dispatch({ type: 'submitted', runId: run.id, rank });
          void invalidate();
        }
      }
    },
    [dispatch, profile, uid, email, gameId, invalidate, order],
  );

  // Final and nothing written yet: decide, once the player's best is known.
  const ready = (!signedIn || !myBest.isLoading) && !signingIn;
  useEffect(() => {
    if (!isFinal(session) || session.submission.status !== 'idle' || !ready) return;
    void act(session, decide(session));
  }, [session, ready, decide, act]);

  /**
   * For "next" or closing while the offer still counts: settle this run from
   * this snapshot — the screen is about to clear it. Asked before the
   * player's best is read, it waits for it rather than dropping the run.
   */
  const pendingSettle = useRef<SessionState | null>(null);
  const settleNow = useCallback(
    (finalized: SessionState) => {
      if (finalized.submission.status !== 'idle') return;
      if (!ready || profile.status === 'loading') {
        pendingSettle.current = finalized;
        return;
      }
      void act(finalized, decide(finalized));
    },
    [act, decide, ready, profile.status],
  );
  useEffect(() => {
    const s = pendingSettle.current;
    if (!s || !ready || profile.status === 'loading') return;
    pendingSettle.current = null;
    void act(s, decide(s));
  }, [ready, profile.status, act, decide]);

  const pickNickname = useCallback(() => {
    setAwaiting('setup');
    setDetour({ state: 'away', step: 'setup' });
    leftRef.current = false;
    router.push({ pathname: '/profile-setup', params: { nickname: '1' } } as never);
  }, [router]);

  /**
   * Google sign-in in place, as the first-launch intro does it — no second
   * screen with the same button. When sign-in lands on a different uid (an
   * account that signed in before), the run on screen is claimed over to it
   * first, with the anonymous account's token as the proof. Then a player
   * without a nickname goes straight on to pick one; with one, the final run
   * is written by the effect above as soon as their profile and best are read.
   * Resolves to what went wrong, or null.
   */
  const signIn = useCallback(async (): Promise<'domain' | 'failed' | 'cancelled' | null> => {
    setSigningIn(true);
    try {
      const run = sessionRef.current.run;
      const anon = getAuth().currentUser;
      const anonIdToken = anon?.isAnonymous && run && run.uid === anon.uid ? await anon.getIdToken() : null;
      const user = await signInWithDeviceMigration('game');
      if (anonIdToken && run && user.uid !== run.uid) {
        // The stamp may still be on its way (App Check priming): claim what exists.
        await runStamped(run.id);
        // Claiming is idempotent on the server, so one retry is safe.
        const claimed = await claimRun(anonIdToken, run.id)
          .catch(() => claimRun(anonIdToken, run.id))
          .then(() => true)
          .catch((err: unknown) => {
            logHandledError('games/claim-run', err); // the run stays unclaimed: "played before signing in"
            return false;
          });
        if (claimed) dispatch({ type: 'runArmed', run: { id: run.id, uid: user.uid } });
      }
      await classifyAndRestoreOnboarding(user.uid, 'game');
      const p = await getProfile(user.uid).catch(() => null);
      if (!p?.nickname) pickNickname();
      else setDetour({ state: 'back', step: 'signIn' });
      return null;
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        if (err.code === 'CANCELLED') return 'cancelled';
        if (err.code === 'DOMAIN_NOT_ALLOWED') return 'domain';
      }
      logHandledError('games/sign-in', err);
      return 'failed';
    } finally {
      setSigningIn(false);
    }
  }, [pickNickname, dispatch]);

  // Back from sign-in or the profile screen: decide again, once, when this
  // screen is in front and the profile and best are read for whoever is
  // signed in now. The final-run effect above then writes it.
  useEffect(() => {
    if (!awaiting) return;
    if (!isFocused) {
      leftRef.current = true;
      return;
    }
    if (!leftRef.current || profile.status === 'loading' || !ready) return;
    const d = decide(session);
    setAwaiting(null);
    setDetour({ state: 'back', step: awaiting });
    if (!isStalledOn(awaiting, d) && isFinal(session) && session.submission.status === 'idle') void act(session, d);
  }, [awaiting, isFocused, profile.status, ready, decide, act, session]);

  /** What stands between a crash and the board that the player could fix now. */
  const needsFor = useCallback(
    (s: SessionState): 'signIn' | 'setup' | null => {
      // Nothing to say until the profile and best are read for whoever is
      // signed in now: an unread profile would pass for "no nickname".
      if (s.phase !== 'crashed' || !s.over || profile.status === 'loading' || !ready) return null;
      const d = decide(s);
      return d.kind === 'signIn' || d.kind === 'setup' ? d.kind : null;
    },
    [decide, profile.status, ready],
  );

  const resetDetour = useCallback(() => setDetour({ state: 'none', step: null }), []);

  return {
    /** Where the last detour stands, and which step it was. */
    detour,
    resetDetour,
    myBest: myBest.data ?? null,
    needsFor,
    signIn,
    pickNickname,
    settleNow,
  };
}
