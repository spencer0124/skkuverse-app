import { KST_OFFSET_MS, kstDate } from '@skkuverse/shared';
import { SCHEDULE_WEEKDAYS } from './notice-schedule.constants';
import type {
  NoticeScheduleDateLabel,
  NoticeScheduleDay,
  NoticeScheduleEntry,
  NoticeScheduleItem,
  NoticeSchedulePhase,
  NoticeSchedulePoint,
  NoticeSchedulePointLabel,
  NoticeScheduleRrule,
  NoticeScheduleSpan,
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

function weekdayOf(date: string): number {
  return new Date(dayMs(date)).getUTCDay();
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** WHY: not `toMinutesOfDay`, which refuses "24:00", the end of a deadline's day that still has to order after "23:59". */
function minutesOf(time: string | undefined): number | null {
  if (time === undefined) return null;
  const match = TIME_RE.exec(time);
  return match === null ? null : Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

/** WHY: a point with a latest day is some day in `date..latest`, so the day it is over by is `latest`. */
function lastDayOf(point: NoticeSchedulePoint): string {
  return point.latest !== undefined && point.latest > point.date ? point.latest : point.date;
}

/** WHY: an end before its start is a stored mistake, so it reads as no end rather than a negative span. */
function validEnd({ start, end }: NoticeScheduleSpan): NoticeSchedulePoint | null {
  if (end === undefined) return null;
  if (start === undefined) return end;
  const endDay = lastDayOf(end);
  if (endDay !== start.date) return endDay < start.date ? null : end;
  const startMinutes = minutesOf(start.time);
  const endMinutes = minutesOf(end.time);
  return startMinutes !== null && endMinutes !== null && endMinutes < startMinutes ? null : end;
}

type Occurrence = NoticeScheduleSpan & { first: NoticeSchedulePoint; last: NoticeSchedulePoint };

function toOccurrence(span: NoticeScheduleSpan): Occurrence | null {
  const first = span.start ?? span.end;
  const last = span.end ?? span.start;
  return first === undefined || last === undefined ? null : { ...span, first, last };
}

function decideOccurrencePhase(occurrence: Occurrence, today: string, nowMinutes: number): NoticeSchedulePhase {
  const { first, last } = occurrence;
  const lastDay = lastDayOf(last);
  const lastMinutes = last.latest === undefined ? minutesOf(last.time) : null;
  if (today > lastDay || (today === lastDay && lastMinutes !== null && nowMinutes >= lastMinutes)) return 'past';
  return today < first.date ? 'upcoming' : 'ongoing';
}

/**
 * WHY: day granularity, but a point with a time is over once that minute has come, as a 22:59 deadline is at 23:00.
 * A series is past only when the server listed every occurrence and all are over.
 */
export function decideSchedulePhase(entry: NoticeScheduleEntry, now: Date): NoticeSchedulePhase {
  const today = kstDate(now.getTime());
  const nowMinutes = Math.floor(((now.getTime() + KST_OFFSET_MS) % MS_PER_DAY) / MS_PER_MINUTE);
  const listed = entry.occurrences.map(toOccurrence).filter((occurrence) => occurrence !== null);
  const own = toOccurrence(entry);
  const occurrences = listed.length > 0 ? listed : own === null ? [] : [own];
  const phases = occurrences.map((occurrence) => decideOccurrencePhase(occurrence, today, nowMinutes));
  if (phases.includes('ongoing')) return 'ongoing';
  if (phases.length > 0 && phases.every((phase) => phase === 'past') && entry.omittedCount === 0) return 'past';
  return 'upcoming';
}

function toDay(date: string, todayYear: number): NoticeScheduleDay {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year === todayYear ? null : year, month, day, weekday: weekdayOf(date) };
}

export function toScheduleDay(date: string, now: Date): NoticeScheduleDay {
  return toDay(date, Number(kstDate(now.getTime()).slice(0, 4)));
}

/** WHY: the label is read off the range, never stored: a stretch that is no month, ten days or week reads as its two days. */
function toPeriodLabel(point: NoticeSchedulePoint, todayYear: number): NoticeSchedulePointLabel {
  const first = toDay(point.date, todayYear);
  const last = toDay(lastDayOf(point), todayYear);
  const [year, month] = point.date.split('-').map(Number);
  const lastOfMonth = lastDayOfMonth(year, month);
  const sameMonth = point.date.slice(0, 7) === lastDayOf(point).slice(0, 7);
  if (sameMonth) {
    const from = first.day;
    const to = last.day;
    if (from === 1 && to === lastOfMonth) return { kind: 'month', year: first.year, month };
    if (to - from === DAYS_PER_WEEK - 1 && to === lastOfMonth) return { kind: 'lastWeek', year: first.year, month };
    if (from === 1 && to === 10) return { kind: 'tenDays', year: first.year, month, tenDays: 'early' };
    if (from === 11 && to === 20) return { kind: 'tenDays', year: first.year, month, tenDays: 'mid' };
    if (from === 21 && to === lastOfMonth) return { kind: 'tenDays', year: first.year, month, tenDays: 'late' };
    if (to - from === DAYS_PER_WEEK - 1 && (from - 1) % DAYS_PER_WEEK === 0) {
      return { kind: 'week', year: first.year, month, week: (from - 1) / DAYS_PER_WEEK + 1 };
    }
  }
  return { kind: 'dayRange', from: first, to: last };
}

function toPointLabel(point: NoticeSchedulePoint, now: Date, isRelativeAllowed: boolean): NoticeSchedulePointLabel {
  const today = kstDate(now.getTime());
  const todayYear = Number(today.slice(0, 4));
  if (point.latest !== undefined && point.latest > point.date) return toPeriodLabel(point, todayYear);
  if (isRelativeAllowed) {
    const daysAway = Math.round((dayMs(point.date) - dayMs(today)) / MS_PER_DAY);
    if (daysAway === 0) return { kind: 'relative', day: 'today' };
    if (daysAway === 1) return { kind: 'relative', day: 'tomorrow' };
    if (daysAway === -1) return { kind: 'relative', day: 'yesterday' };
  }
  return { kind: 'day', date: toDay(point.date, todayYear) };
}

/** WHY: with no byDay the series falls on its start's weekday; Sunday sorts last, as a Korean week reads. */
function weekdaysOf(rrule: NoticeScheduleRrule, start: NoticeSchedulePoint | undefined): number[] {
  if (rrule.freq === 'daily') return [];
  const byDay = rrule.byDay ?? [];
  if (byDay.length === 0) return start === undefined ? [] : [weekdayOf(start.date)];
  const numbers = byDay.map((code) => (SCHEDULE_WEEKDAYS.indexOf(code) + 1) % DAYS_PER_WEEK);
  return [...new Set(numbers)].sort((a, b) => (a || DAYS_PER_WEEK) - (b || DAYS_PER_WEEK));
}

function isSamePoint(a: NoticeSchedulePoint, b: NoticeSchedulePoint): boolean {
  return a.date === b.date && lastDayOf(a) === lastDayOf(b);
}

export function toScheduleDateLabel(
  span: NoticeScheduleSpan & { rrule?: NoticeScheduleRrule },
  now: Date,
): NoticeScheduleDateLabel {
  const { start, rrule } = span;
  const end = validEnd(span);
  if (rrule !== undefined) {
    const todayYear = Number(kstDate(now.getTime()).slice(0, 4));
    return {
      kind: 'repeat',
      freq: rrule.freq,
      weekdays: weekdaysOf(rrule, start),
      until: rrule.until === undefined ? null : toDay(rrule.until, todayYear),
    };
  }
  if (start === undefined) {
    return { kind: 'deadline', to: toPointLabel(end ?? { date: kstDate(now.getTime()) }, now, true) };
  }
  if (end === null || isSamePoint(start, end) || (end.latest === undefined && end.date === start.date)) {
    return toPointLabel(start, now, true);
  }
  return { kind: 'range', from: toPointLabel(start, now, false), to: toPointLabel(end, now, false) };
}

export function toScheduleTimeText(span: NoticeScheduleSpan): string | null {
  const startTime = span.start?.time;
  const endTime = validEnd(span)?.time;
  if (startTime === undefined) return endTime ?? null;
  return endTime === undefined ? startTime : `${startTime}–${endTime}`;
}

export function hasScheduleDetail(entry: NoticeScheduleItem): boolean {
  return (
    (entry.parts?.length ?? 0) > 0 ||
    entry.occurrences.length > 1 ||
    (entry.omittedCount ?? 0) > 0 ||
    (entry.exdate?.length ?? 0) > 0 ||
    (entry.place?.mapTarget ?? null) !== null
  );
}
