/**
 * Schedule utility functions.
 *
 * Flutter source: lib/features/transit/controller/bus_campus_controller.dart
 */

import type { ScheduleEntry, RouteBadge, SmartSchedule, StationEta } from '@skkuuniverse/shared';

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

  return entryMinutes <= nowMinutes;
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

/**
 * Gets the initial day index from the server's selectedDate.
 * Flutter source: SmartSchedule.selectedDayIndex getter
 */
export function getSelectedDayIndex(schedule: SmartSchedule): number {
  if (!schedule.selectedDate || schedule.days.length === 0) return 0;
  const idx = schedule.days.findIndex((d) => d.date === schedule.selectedDate);
  return idx >= 0 ? idx : 0;
}

/**
 * Finds a route badge by routeType, with grey fallback for unknown types.
 * Flutter source: bus_campus_controller.dart (getRouteBadge)
 */
export function getRouteBadge(
  badges: RouteBadge[],
  routeType: string,
): RouteBadge {
  return (
    badges.find((b) => b.id === routeType) ?? {
      id: routeType,
      label: routeType,
      color: '9E9E9E',
    }
  );
}

/**
 * Formats milliseconds duration as Korean time string.
 * Flutter source: bus_campus_controller.dart (formatDuration)
 */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}시간`;
  return `${hours}시간 ${remaining}분`;
}

/**
 * Looks up ETA string for a station index from stationEtas.
 * Flutter source: bus_realtime_controller.dart (etaForStation)
 */
export function etaForStation(
  stationEtas: StationEta[],
  stationIndex: number,
): string | undefined {
  return stationEtas.find((e) => e.stationIndex === stationIndex)?.eta;
}
