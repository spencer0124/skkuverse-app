/**
 * Narrow an untrusted value to a member of a closed union, or `undefined`.
 *
 * Parsers in this package historically wrote `raw.type as 'marker' | 'polyline'`,
 * which is a lie the compiler believes: a server sending `"heatmap"` produces a
 * value whose type says `'marker' | 'polyline'` while every downstream
 * `if (x === 'marker')` and `if (x === 'polyline')` misses, so the thing silently
 * disappears with no error anywhere. `asMember` makes the check real and pushes
 * the decision about what to do with an unknown value back to the caller, which
 * is the only place that knows whether a default or a drop is correct.
 *
 * Used by map/parser.ts, building/parser.ts and eventmap/parser.ts.
 */
export function asMember<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * Coerce to a finite number, or `null`.
 *
 * Deliberately stricter than `Number()`, which answers `0` for `null`, `''`, `[]`
 * and `false`. For a coordinate that is the difference between "dropped" and
 * "rendered in the Gulf of Guinea", so the caller must be handed `null` rather
 * than a plausible-looking zero.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
