import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideClaim } from '../src/games/claimRun.ts';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);
const run = { gameId: 'wave-run', startedAt: minutesAgo(5) };

test('an anonymous run moves to the account the player just signed in as', () => {
  assert.deepEqual(
    decideClaim({ callerUid: 'g1', callerIsSkkuGoogle: true, from: { uid: 'anon', provider: 'anonymous' }, run, existing: false, now: NOW }),
    { kind: 'copy', data: { gameId: 'wave-run', startedAt: run.startedAt } },
  );
});

test('only from an anonymous account, only to a Google skku account, never to itself', () => {
  const base = { callerUid: 'g1', callerIsSkkuGoogle: true, from: { uid: 'anon', provider: 'anonymous' }, run, existing: false, now: NOW };
  assert.deepEqual(decideClaim({ ...base, from: { uid: 'other', provider: 'google.com' } }), { kind: 'refuse', reason: 'not-anonymous' });
  assert.deepEqual(decideClaim({ ...base, callerIsSkkuGoogle: false }), { kind: 'refuse', reason: 'not-skku' });
  assert.deepEqual(decideClaim({ ...base, from: { uid: 'g1', provider: 'anonymous' } }), { kind: 'refuse', reason: 'same-account' });
});

test('the run must exist, be a known game, and still be inside its hour', () => {
  const base = { callerUid: 'g1', callerIsSkkuGoogle: true, from: { uid: 'anon', provider: 'anonymous' }, existing: false, now: NOW };
  assert.deepEqual(decideClaim({ ...base, run: null }), { kind: 'refuse', reason: 'no-run' });
  assert.deepEqual(decideClaim({ ...base, run: { ...run, gameId: 'snake' } }), { kind: 'refuse', reason: 'no-run' });
  assert.deepEqual(decideClaim({ ...base, run: { ...run, startedAt: minutesAgo(61) } }), { kind: 'refuse', reason: 'expired' });
});

test('every game with a board can be claimed', () => {
  const typing = { gameId: 'subway-typing', startedAt: minutesAgo(2) };
  assert.deepEqual(
    decideClaim({ callerUid: 'g1', callerIsSkkuGoogle: true, from: { uid: 'anon', provider: 'anonymous' }, run: typing, existing: false, now: NOW }),
    { kind: 'copy', data: typing },
  );
});

test('a run already there is left as it is (a retry is not an error)', () => {
  assert.deepEqual(
    decideClaim({ callerUid: 'g1', callerIsSkkuGoogle: true, from: { uid: 'anon', provider: 'anonymous' }, run, existing: true, now: NOW }),
    { kind: 'already' },
  );
});

test('isSkkuGoogleToken: the rules’ isSkkuGoogle on a decoded token', async () => {
  const { isSkkuGoogleToken } = await import('../src/games/claimRun.ts');
  const ok = { email: 'a@g.skku.edu', email_verified: true, firebase: { identities: { 'google.com': ['1'] } } };
  assert.equal(isSkkuGoogleToken(ok), true);
  assert.equal(isSkkuGoogleToken({ ...ok, email: 'a@gmail.com' }), false);
  assert.equal(isSkkuGoogleToken({ ...ok, email_verified: false }), false);
  assert.equal(isSkkuGoogleToken({ ...ok, firebase: { identities: { password: ['x'] } } }), false);
  assert.equal(isSkkuGoogleToken(undefined), false);
});
