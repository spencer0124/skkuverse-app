import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnonymousSession,
  retryDelay,
  RETRY_DELAYS_MS,
  STEADY_DELAY_MS,
} from './anon-session.ts';

type Timer = { id: number; fn: () => void; ms: number };

/** Manual clock: nothing fires until the test says so. */
function harness(opts: { user?: boolean } = {}) {
  const timers: Timer[] = [];
  let nextId = 1;
  const failures: unknown[] = [];
  let user = opts.user ?? false;
  let signInCalls = 0;
  // Each signIn call takes the next queued outcome; an unqueued call hangs
  // until settled by hand through `pending`.
  const outcomes: Array<'ok' | 'fail'> = [];
  const pending: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

  const session = createAnonymousSession({
    hasUser: () => user,
    signIn: () => {
      signInCalls++;
      const next = outcomes.shift();
      if (next === 'ok') {
        user = true;
        return Promise.resolve();
      }
      if (next === 'fail') return Promise.reject(new Error('quota'));
      return new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            user = true;
            resolve();
          },
          reject,
        });
      });
    },
    onFirstFailure: (err) => failures.push(err),
    setTimer: (fn, ms) => {
      const t = { id: nextId++, fn, ms };
      timers.push(t);
      return t.id;
    },
    clearTimer: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
    random: () => 0.5, // jitter factor exactly 1.0
  });

  return {
    session,
    timers,
    failures,
    outcomes,
    pending,
    get signInCalls() {
      return signInCalls;
    },
    setUser: (v: boolean) => {
      user = v;
    },
    /** Fire the earliest timer. */
    fire: () => {
      const t = timers.shift();
      assert.ok(t, 'expected a scheduled timer');
      t.fn();
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('anonymous session', () => {
  test('existing session: never signs in, resolves true', async () => {
    const h = harness({ user: true });
    assert.equal(await h.session.start(8_000), true);
    assert.equal(h.signInCalls, 0);
  });

  test('first attempt succeeds: nothing scheduled, nothing logged', async () => {
    const h = harness();
    h.outcomes.push('ok');
    assert.equal(await h.session.start(8_000), true);
    await flush();
    assert.equal(h.signInCalls, 1);
    assert.equal(h.timers.length, 0, 'no retry and the start timeout cleared');
    assert.equal(h.failures.length, 0);
  });

  test('failure never rejects, schedules a retry, and the retry recovers', async () => {
    const h = harness();
    h.outcomes.push('fail', 'ok');
    assert.equal(await h.session.start(8_000), false);
    await flush();
    assert.equal(h.failures.length, 1);
    assert.equal(h.timers.length, 1);
    assert.equal(h.timers[0].ms, RETRY_DELAYS_MS[0]);

    h.fire();
    await flush();
    assert.equal(h.signInCalls, 2, 'the recovery path must actually execute');
    assert.equal(h.timers.length, 0, 'success stops the schedule');
  });

  test('logs only the first failure of the process', async () => {
    const h = harness();
    h.outcomes.push('fail', 'fail', 'fail');
    await h.session.start(8_000);
    await flush();
    h.fire();
    await flush();
    h.fire();
    await flush();
    assert.equal(h.signInCalls, 3);
    assert.equal(h.failures.length, 1);
  });

  test('backs off through the schedule', async () => {
    const h = harness();
    h.outcomes.push('fail', 'fail', 'fail');
    await h.session.start(8_000);
    await flush();
    const seen = [h.timers[0].ms];
    h.fire();
    await flush();
    seen.push(h.timers[0].ms);
    h.fire();
    await flush();
    seen.push(h.timers[0].ms);
    assert.deepEqual(seen, RETRY_DELAYS_MS.slice(0, 3));
  });

  // The race: a retry landing after Google sign-in would replace the Google
  // user with a new anonymous one.
  test('a retry that fires after a sign-in elsewhere does not call signIn', async () => {
    const h = harness();
    h.outcomes.push('fail');
    await h.session.start(8_000);
    await flush();
    h.setUser(true); // Google sign-in landed while the timer waited
    h.fire();
    await flush();
    assert.equal(h.signInCalls, 1);
  });

  test('pause waits out an attempt in flight and suppresses its retry', async () => {
    const h = harness();
    const started = h.session.start(8_000);
    // The start timeout fires first: launch moves on, the attempt keeps going.
    const startTimeout = h.timers.shift()!;
    startTimeout.fn();
    assert.equal(await started, false);

    let paused = false;
    const pausing = h.session.pause().then(() => {
      paused = true;
    });
    await flush();
    assert.equal(paused, false, 'must not return while signIn is in flight');

    h.pending[0].reject(new Error('quota'));
    await pausing;
    assert.equal(h.timers.length, 0, 'no retry while paused');
  });

  test('resume re-arms only when still signed out', async () => {
    const h = harness();
    await h.session.pause();
    h.session.resume();
    assert.equal(h.timers.length, 1, 'signed out → retry scheduled');

    const g = harness();
    await g.session.pause();
    g.setUser(true); // Google sign-in succeeded
    g.session.resume();
    assert.equal(g.timers.length, 0);
  });

  test('a timed-out first attempt schedules its own retry when it fails', async () => {
    const h = harness();
    const started = h.session.start(8_000);
    h.timers.shift()!.fn();
    assert.equal(await started, false);
    assert.equal(h.timers.length, 0);

    h.pending[0].reject(new Error('offline'));
    await flush();
    assert.equal(h.timers.length, 1);
    assert.equal(h.failures.length, 1);
  });

  test('foreground retries at once, replacing the pending timer', async () => {
    const h = harness();
    h.outcomes.push('fail', 'ok');
    await h.session.start(8_000);
    await flush();
    assert.equal(h.timers.length, 1);

    h.session.onForeground();
    await flush();
    assert.equal(h.signInCalls, 2);
    assert.equal(h.timers.length, 0);
  });

  test('foreground is a no-op while an attempt is in flight or when signed in', async () => {
    const h = harness();
    void h.session.start(8_000);
    h.session.onForeground();
    assert.equal(h.signInCalls, 1, 'single flight');

    const g = harness({ user: true });
    g.session.onForeground();
    assert.equal(g.signInCalls, 0);
  });
});

describe('retryDelay', () => {
  test('jitter spans 0.5x to 1.5x of the base', () => {
    assert.equal(retryDelay(0, () => 0), RETRY_DELAYS_MS[0] * 0.5);
    assert.equal(retryDelay(0, () => 0.999999), Math.round(RETRY_DELAYS_MS[0] * 1.499999));
  });

  test('past the schedule, the steady delay repeats', () => {
    const past = RETRY_DELAYS_MS.length;
    assert.equal(retryDelay(past, () => 0.5), STEADY_DELAY_MS);
    assert.equal(retryDelay(past + 10, () => 0.5), STEADY_DELAY_MS);
  });
});
