import { KST_OFFSET_MS, kstDate } from '@skkuverse/shared';
import { SCHEDULE_WEEKDAYS } from './notice-schedule.constants';
import type {
  NoticeScheduleDateLabel,
  NoticeScheduleDay,
  NoticeScheduleItem,
  NoticeSchedulePhase,
  NoticeSchedulePoint,
} from './notice-schedule.types';

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_HOUR = 60;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function dayMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDays(date: string, days: number): string {
  return new Date(dayMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  return new Date(dayMs(date)).getUTCDay();
}

function lastDayOfMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** WHY: not `toMinutesOfDay`, which refuses "24:00", a stored deadline spelling that still has to order after "23:59". */
function minutesOf(time: string | undefined): number | null {
  if (time === undefined) return null;
  const match = TIME_RE.exec(time);
  return match === null ? null : Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

const NO_TIME = -1;

function compareStamp(a: { date: string; minutes: number }, b: { date: string; minutes: number }): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.minutes - b.minutes;
}

/** WHY: an end before its start is a stored mistake, so it reads as no end rather than a negative span. */
function validEnd(item: NoticeScheduleItem): NoticeSchedulePoint | null {
  const { start, end } = item;
  if (end === undefined) return null;
  const startStamp = { date: start.date, minutes: minutesOf(start.time) ?? NO_TIME };
  const endStamp = { date: end.date, minutes: minutesOf(end.time) ?? NO_TIME };
  if (startStamp.minutes === NO_TIME || endStamp.minutes === NO_TIME) {
    return end.date < start.date ? null : end;
  }
  return compareStamp(endStamp, startStamp) < 0 ? null : end;
}

/** WHY: a month or a week item is stored at its first day, but it lasts to the period's last. */
function lastDayOf(item: NoticeScheduleItem): string {
  if (item.precision === 'month') return lastDayOfMonth(item.start.date);
  if (item.precision === 'week') return addDays(item.start.date, DAYS_PER_WEEK - 1);
  return validEnd(item)?.date ?? item.start.date;
}

function endStamp(item: NoticeScheduleItem): { date: string; minutes: number } {
  if (item.precision !== undefined) return { date: lastDayOf(item), minutes: NO_TIME };
  const end = validEnd(item) ?? item.start;
  return { date: end.date, minutes: minutesOf(end.time) ?? NO_TIME };
}

function startStamp(item: NoticeScheduleItem): { date: string; minutes: number } {
  return { date: item.start.date, minutes: minutesOf(item.start.time) ?? NO_TIME };
}

/** WHY: ends on the input position, so items equal on every key keep their stored order. */
export function sortNoticeSchedule(items: readonly NoticeScheduleItem[]): NoticeScheduleItem[] {
  return items
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        compareStamp(endStamp(a.entry), endStamp(b.entry)) ||
        compareStamp(startStamp(a.entry), startStamp(b.entry)) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}

function weekdaysOf(item: NoticeScheduleItem): number[] {
  const byDay = item.repeat?.byDay ?? [];
  if (byDay.length === 0) return [weekdayOf(item.start.date)];
  const numbers = byDay.map((code) => SCHEDULE_WEEKDAYS.indexOf(code) + 1).map((n) => n % DAYS_PER_WEEK);
  return [...new Set(numbers)].sort((a, b) => (a || DAYS_PER_WEEK) - (b || DAYS_PER_WEEK));
}

function decideRepeatPhase(item: NoticeScheduleItem, today: string): NoticeSchedulePhase {
  const { repeat } = item;
  if (repeat?.until !== undefined && today > repeat.until) return 'past';
  if (today < item.start.date) return 'upcoming';
  if (item.except.includes(today)) return 'upcoming';
  const isOccurrenceDay = repeat?.freq === 'daily' || weekdaysOf(item).includes(weekdayOf(today));
  return isOccurrenceDay ? 'ongoing' : 'upcoming';
}

/** WHY: day granularity, with one refinement: an item that ends at a time today is past once that time has come. */
export function decideSchedulePhase(item: NoticeScheduleItem, now: Date): NoticeSchedulePhase {
  const today = kstDate(now.getTime());
  if (item.repeat !== undefined) return decideRepeatPhase(item, today);
  const { start } = item;
  const lastDay = lastDayOf(item);
  if (today < start.date) return 'upcoming';
  if (today > lastDay) return 'past';
  if (item.except.includes(today)) return today < lastDay ? 'upcoming' : 'past';
  const closing = endStamp(item);
  if (item.precision === undefined && today === closing.date && closing.minutes !== NO_TIME && validEnd(item) !== null) {
    const nowMinutes = Math.floor(((now.getTime() + KST_OFFSET_MS) % MS_PER_DAY) / MS_PER_MINUTE);
    if (nowMinutes >= closing.minutes) return 'past';
  }
  return 'ongoing';
}

function toDay(date: string, todayYear: number): NoticeScheduleDay {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year === todayYear ? null : year, month, day, weekday: weekdayOf(date) };
}

export function toScheduleDay(date: string, now: Date): NoticeScheduleDay {
  return toDay(date, Number(kstDate(now.getTime()).slice(0, 4)));
}

export function toScheduleDateLabel(item: NoticeScheduleItem, now: Date): NoticeScheduleDateLabel {
  const today = kstDate(now.getTime());
  const todayYear = Number(today.slice(0, 4));
  const { start, repeat } = item;
  if (repeat !== undefined) {
    return {
      kind: 'repeat',
      freq: repeat.freq,
      weekdays: repeat.freq === 'weekly' ? weekdaysOf(item) : [],
      until: repeat.until === undefined ? null : toDay(repeat.until, todayYear),
    };
  }
  const first = toDay(start.date, todayYear);
  if (item.precision === 'month') return { kind: 'month', year: first.year, month: first.month };
  if (item.precision === 'week') {
    return { kind: 'week', year: first.year, month: first.month, week: Math.ceil(first.day / DAYS_PER_WEEK) };
  }
  const end = validEnd(item);
  if (end !== null && end.date !== start.date) {
    return { kind: 'range', from: first, to: toDay(end.date, todayYear) };
  }
  const daysAway = Math.round((dayMs(start.date) - dayMs(today)) / MS_PER_DAY);
  if (daysAway === 0) return { kind: 'relative', day: 'today' };
  if (daysAway === 1) return { kind: 'relative', day: 'tomorrow' };
  if (daysAway === -1) return { kind: 'relative', day: 'yesterday' };
  return { kind: 'day', date: first };
}

export function toScheduleTimeText(item: NoticeScheduleItem): string | null {
  const { time } = item.start;
  if (time === undefined) return null;
  const endTime = validEnd(item)?.time;
  return endTime === undefined ? time : `${time}–${endTime}`;
}

export function hasScheduleDetail(item: NoticeScheduleItem): boolean {
  return (
    item.slots.length > 0 ||
    item.quote !== undefined ||
    item.except.length > 0 ||
    (item.place?.mapTarget ?? null) !== null
  );
}
