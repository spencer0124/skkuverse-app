import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setEquals,
  shallowEqual,
  pickerSelectionsEqual,
  intentChanged,
  INTENT_FIELDS_HANDLED,
  type IntentFields,
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

// intentChanged — Guard 1 of onPreferencesWrite.
//
// The failure this guards against is silent and delayed: an intent field that
// is not compared here makes its own writes return early, so derive never runs
// and the user is subscribed in intent while receiving nothing.

const BASE: IntentFields = {
  enabled: true,
  categoryEnabled: { essential: true, services: false, notices: true },
  noticeTabEnabled: {},
  pickerSelections: { dept: ['12345'] },
  miniAppSelections: [],
};

test('intentChanged: no change → false (this is what stops the self-loop)', () => {
  assert.equal(intentChanged(BASE, { ...BASE }), false);
});

test('intentChanged: first write (no before doc) → true', () => {
  assert.equal(intentChanged(undefined, BASE), true);
});

test('intentChanged: master toggle → true', () => {
  assert.equal(intentChanged(BASE, { ...BASE, enabled: false }), true);
});

test('intentChanged: category toggle → true', () => {
  assert.equal(
    intentChanged(BASE, {
      ...BASE,
      categoryEnabled: { essential: true, services: true, notices: true },
    }),
    true,
  );
});

test('intentChanged: notice tab toggle → true', () => {
  assert.equal(intentChanged(BASE, { ...BASE, noticeTabEnabled: { library: false } }), true);
});

test('intentChanged: picker selection → true', () => {
  assert.equal(intentChanged(BASE, { ...BASE, pickerSelections: { dept: ['999'] } }), true);
});

test('intentChanged: subscribing to a mini app → true', () => {
  assert.equal(intentChanged(BASE, { ...BASE, miniAppSelections: ['eskara'] }), true);
});

test('intentChanged: unsubscribing from a mini app → true', () => {
  const subscribed: IntentFields = { ...BASE, miniAppSelections: ['eskara'] };
  assert.equal(intentChanged(subscribed, { ...subscribed, miniAppSelections: [] }), true);
});

test('intentChanged: miniAppSelections absent on both sides → false', () => {
  const { miniAppSelections: _omit, ...noField } = BASE;
  assert.equal(intentChanged(noField, { ...noField }), false);
});

test('intentChanged: absent → [] is not a change (documents predating the field)', () => {
  const { miniAppSelections: _omit, ...noField } = BASE;
  assert.equal(intentChanged(noField, { ...noField, miniAppSelections: [] }), false);
});

test('intentChanged: mini-app order is not a change (arrayUnion promises no order)', () => {
  const a: IntentFields = { ...BASE, miniAppSelections: ['eskara', 'hssc'] };
  const b: IntentFields = { ...BASE, miniAppSelections: ['hssc', 'eskara'] };
  assert.equal(intentChanged(a, b), false);
});

// The tripwire itself. This test cannot detect a forgotten field — that is the
// compiler's job, and it fails at INTENT_FIELDS_HANDLED before any test runs.
// What it pins is that the manifest stays exhaustive over the real type rather
// than drifting into a hand-maintained list nobody checks.
test('INTENT_FIELDS_HANDLED covers exactly the intent fields the guard compares', () => {
  const handled = Object.keys(INTENT_FIELDS_HANDLED).sort();
  assert.deepEqual(handled, [
    'categoryEnabled',
    'enabled',
    'miniAppSelections',
    'noticeTabEnabled',
    'pickerSelections',
  ]);
  // Derived fields must never appear here: they are what Guard 1 exists to
  // ignore, and including one would make the trigger retrigger itself.
  assert.ok(!handled.includes('subscribedTopics'));
  assert.ok(!handled.includes('derivedAt'));
});
