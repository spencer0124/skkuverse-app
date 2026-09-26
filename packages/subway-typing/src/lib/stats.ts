import { toKeys } from './hangul';

/** Keys needed to type every name in `names`. */
export const keyCount = (names: readonly string[]) =>
  names.reduce((sum, name) => sum + toKeys(name).length, 0);

/**
 * 타수: keys per minute, the figure Korean typing tests report. Counted in
 * keys rather than characters, so 성균관대 (10 keys) weighs more than 이촌 (5).
 */
export function keysPerMinute(keys: number, ms: number): number {
  return ms > 0 ? Math.round((keys * 60_000) / ms) : 0;
}

/** Share of keystrokes that were right, as a percentage to one decimal. */
export function accuracy(keys: number, typos: number): number {
  const total = keys + typos;
  return total > 0 ? Math.round((keys / total) * 1000) / 10 : 100;
}

/** `m:ss.cc` — a stopwatch readout. */
export function formatTime(ms: number): string {
  const centis = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  const rest = centis % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(rest).padStart(2, '0')}`;
}
