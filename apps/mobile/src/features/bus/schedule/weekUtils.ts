/**
 * Week grouping + Korean label utilities for schedule day navigation.
 */

import type { DaySchedule, TranslationKey } from '@skkuverse/shared';

export interface WeekGroup {
  /** Localized label, e.g. "3월 넷째 주" / "4th week of 3" */
  label: string;
  /** DaySchedule entries for this week (1–7 items) */
  days: DaySchedule[];
  /** Start index into the flat schedule.days array */
  startIndex: number;
}

const ORDINAL_KEYS: Record<number, TranslationKey> = {
  1: 'week.ordinal1',
  2: 'week.ordinal2',
  3: 'week.ordinal3',
  4: 'week.ordinal4',
  5: 'week.ordinal5',
};

/**
 * Generate localized week label from a date string.
 * Uses the date's day-of-month to determine the ordinal week.
 * e.g., March 24 → "3월 넷째 주" (day 24 → ceil(24/7) = 4)
 */
function getWeekLabel(
  dateStr: string,
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): string {
  const [, monthStr, dayStr] = dateStr.split('-');
  const month = Number(monthStr);
  const dayOfMonth = Number(dayStr);
  const weekNum = Math.ceil(dayOfMonth / 7);
  const ordinal = ORDINAL_KEYS[weekNum] ? t(ORDINAL_KEYS[weekNum]) : `${weekNum}`;
  return tpl('week.weekLabel', month, ordinal);
}

/**
 * Groups a flat DaySchedule[] into weeks (Mon–Sun boundaries).
 * A new week starts when dayOfWeek <= previous day's dayOfWeek
 * (i.e., we crossed a Sun→Mon boundary or the array starts).
 */
export function groupDaysByWeek(
  days: DaySchedule[],
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): WeekGroup[] {
  if (days.length === 0) return [];

  const groups: WeekGroup[] = [];
  let currentDays: DaySchedule[] = [];
  let startIndex = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    // Start new week when dayOfWeek resets (Mon after Sun)
    if (currentDays.length > 0 && day.dayOfWeek <= currentDays[currentDays.length - 1].dayOfWeek) {
      groups.push({
        label: getWeekLabel(currentDays[0].date, t, tpl),
        days: currentDays,
        startIndex,
      });
      currentDays = [];
      startIndex = i;
    }
    currentDays.push(day);
  }

  // Push the last group
  if (currentDays.length > 0) {
    groups.push({
      label: getWeekLabel(currentDays[0].date, t, tpl),
      days: currentDays,
      startIndex,
    });
  }

  return groups;
}

/**
 * Given a flat index into schedule.days[], find the corresponding
 * weekIndex and dayInWeekIndex within the week groups.
 */
export function findWeekAndDayIndex(
  weeks: WeekGroup[],
  flatIndex: number,
): { weekIndex: number; dayInWeekIndex: number } {
  for (let w = 0; w < weeks.length; w++) {
    const week = weeks[w];
    if (flatIndex >= week.startIndex && flatIndex < week.startIndex + week.days.length) {
      return { weekIndex: w, dayInWeekIndex: flatIndex - week.startIndex };
    }
  }
  return { weekIndex: 0, dayInWeekIndex: 0 };
}
