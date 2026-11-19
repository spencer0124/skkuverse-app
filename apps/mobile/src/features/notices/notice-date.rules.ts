/**
 * WHY: every day here is a KST calendar day, derived from the epoch, so a phone set to another zone reads
 * "today" and "yesterday" as one in Seoul does. "Local" in the names means the notice's calendar, KST.
 */
import { KST_OFFSET_MS } from '@skkuverse/shared';

const MS_PER_DAY = 86_400_000;

/** WHY: arithmetic, not `kstDate`: an unparsable server date must come out NaN, not throw from `toISOString`. */
export function startOfLocalDay(d: Date): number {
  const t = d.getTime();
  return t - ((((t + KST_OFFSET_MS) % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
}

export function diffDays(fromStartMs: number, toStartMs: number): number {
  return Math.round((toStartMs - fromStartMs) / 86_400_000);
}

/**
 * CONTRACT(skkuverse-crawler): skkuverse-crawler/py/src/skkuverse_crawler/modules/notices/models.py
 * holds only a posting date, and `crawledAt` is not the posting time, so a same-day notice shows its date.
 */
export function formatListDate(date: string): string {
  const parts = date.split('-');
  if (parts.length < 3) return '';
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

export function formatDisplayDate(date: string): string {
  return date.slice(2).replace(/-/g, '.');
}
