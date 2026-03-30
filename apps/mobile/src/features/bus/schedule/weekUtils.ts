/**
 * Week grouping + Korean label utilities for schedule day navigation.
 */

import type { DaySchedule } from '@skkuverse/shared';

export interface WeekGroup {
  /** Korean label, e.g. "3월 넷째 주" */
  label: string;
  /** DaySchedule entries for this week (1–7 items) */
  days: DaySchedule[];
  /** Start index into the flat schedule.days array */
  startIndex: number;
}

const KOREAN_ORDINALS: Record<number, string> = {
  1: '첫째',
  2: '둘째',
  3: '셋째',
  4: '넷째',
  5: '다섯째',
};

/**
 * Generate Korean week label from a date string.
 * Uses the date's day-of-month to determine the ordinal week.
 * e.g., March 24 → "3월 넷째 주" (day 24 → ceil(24/7) = 4)
 */
function getKoreanWeekLabel(dateStr: string): string {
  const [, monthStr, dayStr] = dateStr.split('-');
  const month = Number(monthStr);
  const dayOfMonth = Number(dayStr);
  const weekNum = Math.ceil(dayOfMonth / 7);
  const ordinal = KOREAN_ORDINALS[weekNum] ?? `${weekNum}째`;
  return `${month}월 ${ordinal} 주`;
}

/**
 * Groups a flat DaySchedule[] into weeks (Mon–Sun boundaries).
 * A new week starts when dayOfWeek <= previous day's dayOfWeek
 * (i.e., we crossed a Sun→Mon boundary or the array starts).
 */
export function groupDaysByWeek(days: DaySchedule[]): WeekGroup[] {
  if (days.length === 0) return [];

  const groups: WeekGroup[] = [];
  let currentDays: DaySchedule[] = [];
  let startIndex = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    // Start new week when dayOfWeek resets (Mon after Sun)
    if (currentDays.length > 0 && day.dayOfWeek <= currentDays[currentDays.length - 1].dayOfWeek) {
      groups.push({
        label: getKoreanWeekLabel(currentDays[0].date),
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
      label: getKoreanWeekLabel(currentDays[0].date),
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
