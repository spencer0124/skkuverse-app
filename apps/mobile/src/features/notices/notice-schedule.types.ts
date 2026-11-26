import type {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_PRECISIONS,
  SCHEDULE_STATUSES,
  SCHEDULE_WEEKDAYS,
} from './notice-schedule.constants';

export type NoticeScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
export type NoticeSchedulePrecision = (typeof SCHEDULE_PRECISIONS)[number];
export type NoticeScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];
export type NoticeScheduleWeekday = (typeof SCHEDULE_WEEKDAYS)[number];

export interface NoticeSchedulePoint {
  date: string;
  time?: string;
}

export interface NoticeSchedulePlace {
  text: string;
  name: string | null;
  mapTarget: { skkuId: number; spaceCd: string | null } | null;
}

export interface NoticeScheduleItem {
  id: string;
  title: string;
  start: NoticeSchedulePoint;
  end?: NoticeSchedulePoint;
  precision?: NoticeSchedulePrecision;
  repeat?: { freq: NoticeScheduleFrequency; byDay?: NoticeScheduleWeekday[]; until?: string };
  except: string[];
  slots: { start: NoticeSchedulePoint; end?: NoticeSchedulePoint; text: string }[];
  status: NoticeScheduleStatus;
  quote?: string;
  place?: NoticeSchedulePlace;
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

export type NoticeScheduleDateLabel =
  | { kind: 'relative'; day: 'today' | 'tomorrow' | 'yesterday' }
  | { kind: 'day'; date: NoticeScheduleDay }
  | { kind: 'range'; from: NoticeScheduleDay; to: NoticeScheduleDay }
  | { kind: 'month'; year: number | null; month: number }
  | { kind: 'week'; year: number | null; month: number; week: number }
  | { kind: 'repeat'; freq: NoticeScheduleFrequency; weekdays: number[]; until: NoticeScheduleDay | null };
