/**
 * Equality helpers for the onPreferencesWrite trigger guards.
 *
 * - setEquals: order-insensitive comparison of two string arrays as sets.
 *   Topic lists and id arrays are semantically sets, not ordered lists.
 * - shallowEqual: object equality on the first level. Used for categoryEnabled
 *   diff (3 boolean fields, never nested).
 * - pickerSelectionsEqual: Record<string, string[]> equality (key set + per-key
 *   set equality). Used for pickerSelections diff.
 * - intentChanged: the trigger's Guard 1, extracted so it can be unit-tested.
 */

import type { PreferencesDocument } from '../types.ts';

export function setEquals<T>(
  a: readonly T[] | undefined | null,
  b: readonly T[] | undefined | null,
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  for (const item of b) {
    if (!aSet.has(item)) return false;
  }
  return true;
}

export function shallowEqual<T extends object>(
  a: T | undefined | null,
  b: T | undefined | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a) as (keyof T)[];
  const bKeys = Object.keys(b) as (keyof T)[];
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function pickerSelectionsEqual(
  a: Record<string, string[]> | undefined | null,
  b: Record<string, string[]> | undefined | null,
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!setEquals(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Guard 1 of the onPreferencesWrite trigger: did any CLIENT-WRITABLE intent
 * field actually change?
 *
 * Extracted from the trigger because it is the single point where a new intent
 * field can be forgotten, and forgetting one fails in the worst possible way:
 * silently, and only later. A field missing here means writes to it return
 * early, so derive never runs, `subscribedTopics` never gains the topic, the
 * device replica never syncs — and the user is subscribed in intent while
 * receiving nothing, until some unrelated toggle happens to move one of the
 * other fields.
 *
 * ADDING AN INTENT FIELD? Add it here and to the test in test/equality.test.ts.
 * Derived fields (`subscribedTopics`, `derivedAt`) must stay out: they are what
 * this guard exists to ignore, so the trigger does not retrigger itself.
 */
export function intentChanged(
  before: IntentFields | undefined,
  after: IntentFields,
): boolean {
  return (
    before?.enabled !== after.enabled ||
    !shallowEqual(before?.categoryEnabled, after.categoryEnabled) ||
    !shallowEqual(before?.noticeTabEnabled, after.noticeTabEnabled) ||
    !pickerSelectionsEqual(before?.pickerSelections, after.pickerSelections) ||
    // Written on its own, one id at a time, so it touches none of the above.
    !setEquals(before?.miniAppSelections ?? [], after.miniAppSelections ?? [])
  );
}

/**
 * The subset of PreferencesDocument that Guard 1 reads.
 *
 * A Pick rather than a hand-written shape, so renaming or retyping an intent
 * field in types.ts is a compile error here instead of a guard that silently
 * stops matching.
 */
export type IntentFields = Pick<
  PreferencesDocument,
  'enabled' | 'categoryEnabled' | 'noticeTabEnabled' | 'pickerSelections' | 'miniAppSelections'
>;
