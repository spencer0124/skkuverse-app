/**
 * The scroll lock that keeps a pinch zooming about the location dot.
 *
 * The cases that would hurt are the seams: the SDK dropping tracking at the
 * start of the pinch (which must not unlock it), a pinch ending on one finger
 * (which must stay locked), and a plain drag (which must never lock).
 *
 * NOTE: apps/mobile runs `node --test`, a different runner from packages/shared's
 * vitest. `pinchLock.ts` imports nothing at all, so it loads under plain Node.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NO_PINCH, stepPinchLock } from './pinchLock.ts';

describe('stepPinchLock', () => {
  it('locks at the second finger while following', () => {
    const one = stepPinchLock(NO_PINCH, 1, true);
    assert.equal(one.locked, false, 'one finger is a drag, and drags scroll');
    assert.deepEqual(stepPinchLock(one, 2, true), { pinching: true, locked: true });
  });

  it('does not lock a pinch on a map that is not following', () => {
    assert.deepEqual(stepPinchLock(NO_PINCH, 2, false), { pinching: true, locked: false });
  });

  it('keeps the lock when tracking drops mid-pinch', () => {
    // The SDK reports NoFollow at the start of the pinch; the lock was decided
    // from the mode before that and must not follow it.
    const locked = stepPinchLock(NO_PINCH, 2, true);
    assert.equal(stepPinchLock(locked, 2, false), locked);
  });

  it('stays locked while the last finger drags', () => {
    const locked = stepPinchLock(NO_PINCH, 2, true);
    assert.equal(stepPinchLock(locked, 1, false).locked, true);
  });

  it('lets go when every finger is up', () => {
    const locked = stepPinchLock(NO_PINCH, 2, true);
    assert.equal(stepPinchLock(locked, 0, false), NO_PINCH);
  });

  it('does not re-decide when tracking starts mid-pinch', () => {
    const loose = stepPinchLock(NO_PINCH, 2, false);
    assert.equal(stepPinchLock(loose, 2, true), loose);
  });

  it('keeps the same object for touches that change nothing', () => {
    assert.equal(stepPinchLock(NO_PINCH, 1, true), NO_PINCH);
    assert.equal(stepPinchLock(NO_PINCH, 0, true), NO_PINCH);
    const locked = stepPinchLock(NO_PINCH, 2, true);
    assert.equal(stepPinchLock(locked, 3, true), locked);
  });
});
