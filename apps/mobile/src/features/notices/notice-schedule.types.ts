import type { SCHEDULE_FREQUENCIES, SCHEDULE_STATUSES, SCHEDULE_WEEKDAYS } from './notice-schedule.constants';

export type NoticeScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
export type NoticeScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];
export type NoticeScheduleWeekday = (typeof SCHEDULE_WEEKDAYS)[number];

/** CONTRACT(skkuverse-server): skkuverse-server/contracts/produced/notices.noticeScheduleItem.schema.json: `time` is Seoul "HH:MM", `24:00` only on an end, and `latest` (never with a time) makes the point some day in `date..latest`. */
export interface NoticeSchedulePoint {
  date: string;
  time?: string;
  latest?: string;
}

/** WHY: a start, an end, or both; an end alone is a deadline. */
export interface NoticeScheduleSpan {
  start?: NoticeSchedulePoint;
  end?: NoticeSchedulePoint;
}

export interface NoticeSchedulePlace {
  text: string;
  name: string | null;
  mapTarget: { skkuId: number; spaceCd: string | null } | null;
}

export interface NoticeScheduleRrule {
  freq: NoticeScheduleFrequency;
  byDay?: NoticeScheduleWeekday[];
  until?: string;
}

export interface NoticeScheduleEntry extends NoticeScheduleSpan {
  id: string;
  title: string;
  status: NoticeScheduleStatus;
  rrule?: NoticeScheduleRrule;
  exdate?: string[];
  place?: NoticeSchedulePlace;
  /** WHY: the server's expansion of the series, the first 31; `omittedCount` is the rest, and null for a series with no end. */
  occurrences: NoticeScheduleSpan[];
  omittedCount: number | null;
}

/** WHY: a part is an agenda entry inside an item, and the server serves no part of a part. */
export interface NoticeScheduleItem extends NoticeScheduleEntry {
  parts?: NoticeScheduleEntry[];
}

export type NoticeSchedulePhase = 'past' | 'ongoing' | 'upcoming';

/** WHY: `year` is null in the current year, so a label names a year only when it differs from today's. */
export interface NoticeScheduleDay {
  year: number | null;
  month: number;
  day: number;
  /** WHY: 0 is Sunday, as `Date.getUTCDay` counts. */
  weekday: number;
}

export type NoticeScheduleTenDays = 'early' | 'mid' | 'late';

export type NoticeSchedulePointLabel =
  | { kind: 'relative'; day: 'today' | 'tomorrow' | 'yesterday' }
  | { kind: 'day'; date: NoticeScheduleDay }
  | { kind: 'dayRange'; from: NoticeScheduleDay; to: NoticeScheduleDay }
  | { kind: 'month'; year: number | null; month: number }
  | { kind: 'tenDays'; year: number | null; month: number; tenDays: NoticeScheduleTenDays }
  | { kind: 'week'; year: number | null; month: number; week: number }
  | { kind: 'lastWeek'; year: number | null; month: number };

export type NoticeScheduleDateLabel =
  | NoticeSchedulePointLabel
  | { kind: 'range'; from: NoticeSchedulePointLabel; to: NoticeSchedulePointLabel }
  | { kind: 'deadline'; to: NoticeSchedulePointLabel }
  | { kind: 'repeat'; freq: NoticeScheduleFrequency; weekdays: number[]; until: NoticeScheduleDay | null };
