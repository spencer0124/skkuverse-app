import { assert, test } from 'vitest';
import { gameReducer, initialGame, totalMs } from './game';

const step = gameReducer(2);

test('the clock starts on the first key, and only once', () => {
  let s = step(initialGame, { type: 'start' });
  assert.strictEqual(s.startedAt, null);
  s = step(s, { type: 'key', now: 1000 });
  s = step(s, { type: 'key', now: 1500 });
  assert.strictEqual(s.startedAt, 1000);
});

test('arriving at the last station finishes the run', () => {
  let s = step(initialGame, { type: 'start' });
  s = step(s, { type: 'key', now: 1000 });
  s = step(s, { type: 'arrive', now: 3000 });
  assert.strictEqual(s.phase, 'playing');
  s = step(s, { type: 'typo' });
  s = step(s, { type: 'arrive', now: 4500 });
  assert.strictEqual(s.phase, 'finished');
  assert.deepEqual(s.arrivals, [2000, 3500]);
  assert.strictEqual(s.typos, 1);
  assert.strictEqual(totalMs(s), 3500);
});

test('nothing moves outside a run', () => {
  assert.strictEqual(step(initialGame, { type: 'arrive', now: 1 }), initialGame);
  assert.strictEqual(step(initialGame, { type: 'typo' }), initialGame);
});

test('reset goes back to the title from anywhere', () => {
  let s = step(initialGame, { type: 'start' });
  s = step(s, { type: 'key', now: 1000 });
  assert.strictEqual(step(s, { type: 'reset' }), initialGame);
});
