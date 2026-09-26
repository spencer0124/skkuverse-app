import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESTORE_MIN_OFFSET, scrollToRestore, stableHeaderHeight } from './swipe-guard.ts';

test('header height follows reports outside a transition', () => {
  assert.equal(stableHeaderHeight(0, 116, false), 116);
  assert.equal(stableHeaderHeight(116, 108, false), 108);
});

test('header height holds still during a transition', () => {
  assert.equal(stableHeaderHeight(116, 0, true), 116);
  assert.equal(stableHeaderHeight(116, 62, true), 116);
});

test('a hidden bar (height 0) never replaces a real header height', () => {
  assert.equal(stableHeaderHeight(116, 0, false), 116);
  assert.equal(stableHeaderHeight(116, Number.NaN, false), 116);
});

test('the first report is taken even mid-transition', () => {
  assert.equal(stableHeaderHeight(0, 116, true), 116);
  assert.equal(stableHeaderHeight(0, 0, true), 0);
});

test('a page thrown back to the top is restored', () => {
  assert.equal(scrollToRestore(1200, 0), 1200);
  assert.equal(scrollToRestore(800.4, 10), 800);
});

test('a page that stayed put, or was near the top, is left alone', () => {
  assert.equal(scrollToRestore(1200, 1200), null);
  assert.equal(scrollToRestore(1200, 700), null);
  assert.equal(scrollToRestore(RESTORE_MIN_OFFSET - 1, 0), null);
  assert.equal(scrollToRestore(Number.NaN, 0), null);
});
