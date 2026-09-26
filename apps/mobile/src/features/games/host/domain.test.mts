import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntry,
  canRevive,
  decideSubmit,
  initialSession,
  isFinal,
  isStalledOn,
  sessionReducer,
  type SessionState,
} from './domain.ts';

const over = { score: 420, ticks: 3000, hit: 'bus', revives: 0, revivesLeft: 2 };
const profile = { campus: 'hssc' as const, nickname: '파도왕' };

function crashed(o: Partial<typeof over> = {}): SessionState {
  let s = initialSession();
  s = sessionReducer(s, { type: 'page', message: { type: 'game:ready' } });
  s = sessionReducer(s, { type: 'runArmed', run: { id: 'r1', uid: 'u1' } });
  s = sessionReducer(s, { type: 'page', message: { type: 'game:phase', phase: 'running' } });
  s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over, ...o } });
  return s;
}

describe('session', () => {
  test('follows the page: loading → ready → running → crashed with the result', () => {
    const s = crashed();
    assert.equal(s.phase, 'crashed');
    assert.deepEqual(s.over, over);
    assert.deepEqual(s.run, { id: 'r1', uid: 'u1' });
  });

  test('a crash with revives left opens the offer; without, the run is final at once', () => {
    assert.equal(crashed().offer, 'open');
    assert.equal(isFinal(crashed()), false);
    const last = crashed({ revives: 2, revivesLeft: 0 });
    assert.equal(last.offer, 'closed');
    assert.equal(isFinal(last), true);
  });

  test('the offer closes when it runs out or when the ad earns nothing (shown spent)', () => {
    for (const type of ['offerExpired', 'reviveFailed'] as const) {
      let s = crashed();
      if (type === 'reviveFailed') s = sessionReducer(s, { type: 'reviveStarted' });
      s = sessionReducer(s, { type });
      assert.equal(s.offer, 'closed', type);
      assert.equal(isFinal(s), true, type);
    }
  });

  test('no ad to play makes the offer unavailable (not shown at all), and the crash final', () => {
    const s = sessionReducer(crashed(), { type: 'offerUnavailable' });
    assert.equal(s.offer, 'unavailable');
    assert.equal(isFinal(s), true);
    assert.equal(canRevive(s, true), false);
  });

  test('watching the ad holds the offer open (the countdown stops)', () => {
    const s = sessionReducer(crashed(), { type: 'reviveStarted' });
    assert.equal(s.offer, 'watching');
    assert.equal(sessionReducer(s, { type: 'offerExpired' }).offer, 'watching');
    assert.equal(isFinal(s), false);
  });

  test('a revive clears the result and the offer; the next crash opens a new one', () => {
    let s = sessionReducer(crashed(), { type: 'reviveStarted' });
    s = sessionReducer(s, { type: 'page', message: { type: 'game:phase', phase: 'running' } });
    assert.equal(s.over, null);
    assert.equal(s.offer, 'none');
    s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over, score: 900, revives: 1, revivesLeft: 1 } });
    assert.equal(s.over?.score, 900);
    assert.equal(s.offer, 'open');
    assert.deepEqual(s.run, { id: 'r1', uid: 'u1' });
  });

  test('a page reload during a crash makes the crash final rather than losing it', () => {
    for (const offer of ['open', 'watching'] as const) {
      let s = crashed();
      if (offer === 'watching') s = sessionReducer(s, { type: 'reviveStarted' });
      s = sessionReducer(s, { type: 'page', message: { type: 'game:ready' } });
      assert.equal(s.phase, 'crashed', offer);
      assert.equal(isFinal(s), true, offer);
      assert.equal(s.over?.score, 420, offer);
    }
  });

  test('a repeated game:over does not reopen an offer that closed or is being watched', () => {
    let s = sessionReducer(crashed(), { type: 'offerExpired' });
    s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over } });
    assert.equal(s.offer, 'closed');
    let w = sessionReducer(crashed(), { type: 'reviveStarted' });
    w = sessionReducer(w, { type: 'page', message: { type: 'game:over', ...over } });
    assert.equal(w.offer, 'watching');
  });

  test('finalize closes the offer ("next" while it is still counting)', () => {
    const s = sessionReducer(crashed(), { type: 'finalize' });
    assert.equal(isFinal(s), true);
  });

  test('a restart after a crash that outlived a page reload goes back to the title phase', () => {
    let s = sessionReducer(crashed(), { type: 'page', message: { type: 'game:ready' } });
    assert.equal(s.phase, 'crashed');
    s = sessionReducer(s, { type: 'restart' });
    assert.equal(s.phase, 'ready');
  });

  test('a restart forgets the result, the run, the offer and the submission', () => {
    let s = sessionReducer(crashed(), { type: 'finalize' });
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 3 });
    s = sessionReducer(s, { type: 'restart' });
    assert.equal(s.over, null);
    assert.equal(s.run, null);
    assert.equal(s.offer, 'none');
    assert.equal(s.submission.status, 'idle');
  });

  test('a submission that settles after a restart does not land on the next run', () => {
    let s = sessionReducer(crashed(), { type: 'submitStart', runId: 'r1' });
    s = sessionReducer(s, { type: 'restart' });
    s = sessionReducer(s, { type: 'runArmed', run: { id: 'r2', uid: 'u1' } });
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 5 });
    assert.equal(s.submission.status, 'idle');
  });

  test('the same run re-armed under the account it was claimed to starts its submission over', () => {
    let s = sessionReducer(crashed(), { type: 'offerExpired' });
    s = sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason: 'otherAccount' });
    s = sessionReducer(s, { type: 'runArmed', run: { id: 'r1', uid: 'g1' } });
    assert.deepEqual(s.run, { id: 'r1', uid: 'g1' });
    assert.equal(s.submission.status, 'idle');
    assert.equal(isFinal(s), true);
  });

  test('submission states', () => {
    let s = sessionReducer(crashed(), { type: 'submitStart', runId: 'r1' });
    assert.equal(s.submission.status, 'submitting');
    s = sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason: 'rejected' });
    assert.deepEqual(s.submission, { status: 'failed', reason: 'rejected' });
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 12 });
    assert.deepEqual(s.submission, { status: 'submitted', rank: 12 });
    s = sessionReducer(s, { type: 'notImproved', runId: 'r1' });
    assert.deepEqual(s.submission, { status: 'notImproved' });
  });
});

describe('canRevive', () => {
  test('only while the offer is open and an ad is ready', () => {
    assert.equal(canRevive(crashed(), true), true);
    assert.equal(canRevive(crashed(), false), false);
    assert.equal(canRevive(sessionReducer(crashed(), { type: 'offerExpired' }), true), false);
    assert.equal(canRevive(sessionReducer(crashed(), { type: 'reviveStarted' }), true), false);
  });
});

describe('decideSubmit', () => {
  const base = {
    uid: 'u1',
    isAnonymous: false,
    emailPrefix: 'wav',
    run: { id: 'r1', uid: 'u1' },
    profile,
    score: 420,
    myBest: 300 as number | null,
    better: (a: number, b: number) => a > b,
    maxEntry: 99999,
  };

  test('a new personal best with everything in place → submit', () => {
    assert.deepEqual(decideSubmit(base), { kind: 'submit' });
    assert.deepEqual(decideSubmit({ ...base, myBest: null }), { kind: 'submit' });
  });
  test('no better than the best already on the board → nothing to write', () => {
    assert.deepEqual(decideSubmit({ ...base, myBest: 420 }), { kind: 'notImproved' });
    assert.deepEqual(decideSubmit({ ...base, myBest: 999 }), { kind: 'notImproved' });
  });
  test('a zero or impossible score is never written', () => {
    assert.deepEqual(decideSubmit({ ...base, score: 0 }), { kind: 'notImproved' });
    assert.deepEqual(decideSubmit({ ...base, score: 100000 }), { kind: 'rejected' });
  });
  test('anonymous or signed out → sign in first, whatever a stale best says', () => {
    assert.deepEqual(decideSubmit({ ...base, isAnonymous: true }), { kind: 'signIn' });
    assert.deepEqual(decideSubmit({ ...base, uid: null }), { kind: 'signIn' });
    assert.deepEqual(decideSubmit({ ...base, isAnonymous: true, myBest: 999 }), { kind: 'signIn' });
  });
  test('the run belongs to the account from before sign-in → cannot', () => {
    assert.deepEqual(decideSubmit({ ...base, run: { id: 'r1', uid: 'anon' } }), { kind: 'otherAccount' });
  });
  test('no run at all (nobody was signed in when it started) → nothing to offer', () => {
    assert.deepEqual(decideSubmit({ ...base, run: null }), { kind: 'noRun' });
    assert.deepEqual(decideSubmit({ ...base, run: null, isAnonymous: true }), { kind: 'noRun' });
  });
  test('a time (less is better): only a faster run is written', () => {
    const time = { ...base, better: (a: number, b: number) => a < b, maxEntry: 3_600_000, myBest: 60_000 };
    assert.deepEqual(decideSubmit({ ...time, score: 55_000 }), { kind: 'submit' });
    assert.deepEqual(decideSubmit({ ...time, score: 60_000 }), { kind: 'notImproved' });
    assert.deepEqual(decideSubmit({ ...time, score: 70_000 }), { kind: 'notImproved' });
    assert.deepEqual(decideSubmit({ ...time, score: 3_600_001 }), { kind: 'rejected' });
    assert.deepEqual(decideSubmit({ ...time, score: 0 }), { kind: 'notImproved' });
  });
  test('no usable email prefix → cannot', () => {
    assert.deepEqual(decideSubmit({ ...base, emailPrefix: null }), { kind: 'rejected' });
  });
  test('no profile or no nickname → ask', () => {
    assert.deepEqual(decideSubmit({ ...base, profile: null }), { kind: 'setup' });
    assert.deepEqual(decideSubmit({ ...base, profile: { ...profile, nickname: null } }), { kind: 'setup' });
  });
});

describe('isStalledOn', () => {
  test('coming back to the same requirement means the player backed out', () => {
    assert.equal(isStalledOn('signIn', { kind: 'signIn' }), true);
    assert.equal(isStalledOn('setup', { kind: 'setup' }), true);
    assert.equal(isStalledOn('signIn', { kind: 'setup' }), false);
  });
});

describe('buildEntry', () => {
  test('the fields a best-per-player entry carries, all but the server-stamped updatedAt', () => {
    assert.deepEqual(
      buildEntry({ uid: 'u1', runId: 'r1', over, profile, emailPrefix: 'wav' }),
      { uid: 'u1', runId: 'r1', score: 420, revives: 0, nickname: '파도왕', emailPrefix: 'wav', campus: 'hssc' },
    );
  });
});
