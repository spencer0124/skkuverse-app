import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setEquals,
  shallowEqual,
  pickerSelectionsEqual,
} from '../src/utils/equality.ts';

// setEquals
test('setEquals: same elements different order → true', () => {
  assert.equal(setEquals(['a', 'b', 'c'], ['c', 'a', 'b']), true);
});

test('setEquals: different elements → false', () => {
  assert.equal(setEquals(['a', 'b'], ['a', 'c']), false);
});

test('setEquals: different lengths → false', () => {
  assert.equal(setEquals(['a'], ['a', 'b']), false);
});

test('setEquals: both empty → true', () => {
  assert.equal(setEquals([], []), true);
});

test('setEquals: both null/undefined → true', () => {
  assert.equal(setEquals(null, undefined), true);
});

test('setEquals: one null other [] → false (semantic differ on absence vs empty)', () => {
  assert.equal(setEquals(null, []), false);
});

// shallowEqual
test('shallowEqual: same shape same values → true', () => {
  assert.equal(
    shallowEqual({ a: 1, b: true }, { a: 1, b: true }),
    true,
  );
});

test('shallowEqual: different value → false', () => {
  assert.equal(
    shallowEqual({ a: 1 }, { a: 2 }),
    false,
  );
});

test('shallowEqual: extra key → false', () => {
  assert.equal(
    shallowEqual({ a: 1 }, { a: 1, b: 2 }),
    false,
  );
});

test('shallowEqual: both undefined → true', () => {
  assert.equal(shallowEqual(undefined, undefined), true);
});

// pickerSelectionsEqual
test('pickerSelectionsEqual: same shape same array sets → true', () => {
  assert.equal(
    pickerSelectionsEqual(
      { dept: ['A', 'B'], library: ['x'] },
      { library: ['x'], dept: ['B', 'A'] },
    ),
    true,
  );
});

test('pickerSelectionsEqual: different array contents → false', () => {
  assert.equal(
    pickerSelectionsEqual({ dept: ['A'] }, { dept: ['B'] }),
    false,
  );
});

test('pickerSelectionsEqual: extra key → false', () => {
  assert.equal(
    pickerSelectionsEqual({ dept: ['A'] }, { dept: ['A'], library: ['x'] }),
    false,
  );
});

test('pickerSelectionsEqual: both empty → true', () => {
  assert.equal(pickerSelectionsEqual({}, {}), true);
});
