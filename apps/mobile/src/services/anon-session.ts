/**
 * Anonymous sign-in that never blocks the caller, plus the retry that
 * recovers it.
 *
 * ── Why it must not block ────────────────────────────────────────────────
 *
 * `signInAnonymously` used to be awaited inside `useAppInit`, and a failure sent
 * InitGate to "앱을 시작할 수 없어요" with no retry button — a dead end. Firebase
 * counts every anonymous account against the per-IP sign-up quota (100/hour by
 * default), so on a festival Wi-Fi or a carrier NAT the 101st fresh install in
 * an hour could not open the app at all, and nothing reached Crashlytics.
 *
 * A signed-out app is already a supported state: `onAuthStateChanged(null)`
 * calls `setUnauthenticated()`, which leaves `isAnonymous: true` and sets
 * `isInitialized`, so the intro and notices gates behave exactly as for an
 * anonymous user. Public data (bus, map) needs no identity, and Google sign-in
 * does not count against that quota — `signInWithGoogle` takes the
 * `signInWithCredential` branch when there is no current user.
 *
 * Every anonymous sign-in goes through here: cold start, and the re-sign-in
 * after a Google sign-out or an account deletion. A second caller of
 * `signInAnonymously` would race this one and could create two accounts.
 *
 * ── The race this module exists to close ─────────────────────────────────
 *
 * `signInAnonymously` with a Google user signed in REPLACES that user with a
 * new anonymous one. A retry resolving after a Google sign-in would silently
 * sign the student out. So every attempt re-checks `hasUser()` immediately
 * before calling, and the Google flow calls `pause()` — which also waits out an
 * attempt already in flight — before opening the sheet, then `resume()`.
 * Pauses nest: two overlapping sign-in flows (a double tap) must both finish
 * before retries resume.
 *
 * ── Deliberately import-free ─────────────────────────────────────────────
 *
 * Firebase, timers, randomness and logging are injected, so this loads under
 * `node --experimental-strip-types --test`. The 2026-07 and 2026-09 ghost
 * incidents were both recovery paths that could not execute and read as though
 * they did; the test file is what proves this one runs. Wiring lives in
 * `anon-session-instance.ts`.
 */

/** Delays before retries 1..n. After the last, `STEADY_DELAY_MS` repeats. */
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 300_000] as const;
export const STEADY_DELAY_MS = 600_000;

/**
 * Spread factor applied to every delay. A crowd behind one NAT fails together;
 * without jitter it would also retry together.
 */
const JITTER_MIN = 0.5;
const JITTER_SPAN = 1.0;

export interface AnonymousSessionDeps {
  hasUser: () => boolean;
  signIn: () => Promise<unknown>;
  /** Called once per process, on the first failed attempt. */
  onFirstFailure: (err: unknown) => void;
  /** How long `ensure()` waits on its attempt before resolving anyway. */
  timeoutMs: number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** Returns [0, 1). Injected for deterministic tests. */
  random: () => number;
}

export interface AnonymousSession {
  /**
   * Signs in anonymously unless someone is signed in, resolving once the
   * attempt settles or `timeoutMs` elapses, whichever comes first. Never
   * rejects. A timed-out attempt keeps running, and schedules the retry itself
   * if it then fails.
   * @returns whether a user exists when it resolves.
   */
  ensure: () => Promise<boolean>;
  /**
   * Retry now if signed out — the app returning to the foreground. A no-op
   * until the first `ensure()`, which runs after App Check is initialized.
   */
  onForeground: () => void;
  /** Stop scheduling and wait out an attempt in flight. Nests. */
  pause: () => Promise<void>;
  /** Undo one `pause()`; the last one re-arms, and only if still signed out. */
  resume: () => void;
}

export function retryDelay(retryIndex: number, random: () => number): number {
  const base = RETRY_DELAYS_MS[retryIndex] ?? STEADY_DELAY_MS;
  return Math.round(base * (JITTER_MIN + random() * JITTER_SPAN));
}

export function createAnonymousSession(deps: AnonymousSessionDeps): AnonymousSession {
  let inFlight: Promise<boolean> | null = null;
  let timer: unknown = null;
  let retryIndex = 0;
  let pauseDepth = 0;
  let started = false;
  let reported = false;

  function cancelTimer() {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
  }

  function schedule() {
    if (pauseDepth > 0 || timer !== null || deps.hasUser()) return;
    timer = deps.setTimer(() => {
      // Advanced on firing, not on arming: a timer cancelled by pause() or
      // onForeground() must not push the backoff a step further.
      timer = null;
      retryIndex++;
      void attempt();
    }, retryDelay(retryIndex, deps.random));
  }

  function attempt(): Promise<boolean> {
    if (inFlight) return inFlight;
    // The guard against replacing a Google user. Checked here, not at
    // scheduling time, because a sign-in can land while the timer waits.
    if (pauseDepth > 0 || deps.hasUser()) return Promise.resolve(deps.hasUser());

    // Promise.resolve().then(...) so a synchronous throw from signIn becomes a
    // rejection like any other, and inFlight is always cleared. That defers
    // the call by a microtask, so the guard is repeated at the moment of the
    // call — a pause() issued in the same tick must still win.
    inFlight = Promise.resolve()
      .then(() => {
        if (pauseDepth > 0 || deps.hasUser()) return;
        return deps.signIn();
      })
      .then(
        () => {
          retryIndex = 0;
          return deps.hasUser();
        },
        (err: unknown) => {
          if (!reported) {
            reported = true;
            try {
              deps.onFirstFailure(err);
            } catch {
              // Logging must never wedge the scheduler.
            }
          }
          return false;
        },
      )
      .then((ok) => {
        inFlight = null;
        if (!ok) schedule();
        return ok;
      });
    return inFlight;
  }

  return {
    ensure() {
      started = true;
      cancelTimer();
      return new Promise<boolean>((resolve) => {
        const handle = deps.setTimer(() => resolve(deps.hasUser()), deps.timeoutMs);
        void attempt().then((ok) => {
          deps.clearTimer(handle);
          resolve(ok);
        });
      });
    },

    onForeground() {
      if (!started || pauseDepth > 0 || inFlight || deps.hasUser()) return;
      cancelTimer();
      void attempt();
    },

    async pause() {
      pauseDepth++;
      cancelTimer();
      if (inFlight) await inFlight;
    },

    resume() {
      pauseDepth = Math.max(0, pauseDepth - 1);
      schedule();
    },
  };
}
