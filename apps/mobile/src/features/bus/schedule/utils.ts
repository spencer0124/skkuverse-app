/**
 * Schedule utility functions.
 *
 * Flutter source: lib/features/transit/widgets/ (various schedule widgets)
 */

import type { ScheduleEntry } from '@skkuuniverse/shared';

/**
 * Finds the next departure from schedule entries.
 * Returns the first entry whose time is in the future (or within showUntilMinutesBefore).
 */
export function getHeroBus(
  entries: ScheduleEntry[],
  isToday: boolean,
  showUntilMinutesBefore: number,
): ScheduleEntry | undefined {
  if (entries.length === 0) return undefined;
  if (!isToday) return entries[0];

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const entry of entries) {
    const [h, m] = entry.time.split(':').map(Number);
    const entryMinutes = h * 60 + m;
    // Skip buses too close to departure (within showUntilMinutesBefore)
    if (showUntilMinutesBefore > 0 && (entryMinutes - showUntilMinutesBefore) < nowMinutes) {
      continue;
    }
    if (entryMinutes > nowMinutes) return entry;
  }
  return undefined; // all buses departed
}

/**
 * Checks if a schedule entry is in the past (for greying out).
 */
export function isPastBus(entry: ScheduleEntry, isToday: boolean): boolean {
  if (!isToday) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [h, m] = entry.time.split(':').map(Number);
  const entryMinutes = h * 60 + m;

  return entryMinutes < nowMinutes;
}

/**
 * Gets minutes until a schedule entry departs.
 */
export function getMinutesUntil(entry: ScheduleEntry): number {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [h, m] = entry.time.split(':').map(Number);
  const entryMinutes = h * 60 + m;

  return entryMinutes - nowMinutes;
}

/**
 * Formats minutes until departure as Korean string.
 */
export function formatETA(minutes: number): string {
  if (minutes <= 0) return '곧 출발';
  if (minutes < 60) return `${minutes}분 후`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}시간 후`;
  return `${hours}시간 ${remaining}분 후`;
}

/**
 * Checks if entries have multiple route types (determines badge visibility).
 */
export function hasMultipleRouteTypes(entries: ScheduleEntry[]): boolean {
  if (entries.length === 0) return false;
  const types = new Set(entries.map((e) => e.routeType));
  return types.size > 1;
}
