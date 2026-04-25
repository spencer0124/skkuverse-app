/**
 * Equality helpers for the onPreferencesWrite trigger guards.
 *
 * - setEquals: order-insensitive comparison of two string arrays as sets.
 *   Topic lists and id arrays are semantically sets, not ordered lists.
 * - shallowEqual: object equality on the first level. Used for categoryEnabled
 *   diff (3 boolean fields, never nested).
 * - pickerSelectionsEqual: Record<string, string[]> equality (key set + per-key
 *   set equality). Used for pickerSelections diff.
 */

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
