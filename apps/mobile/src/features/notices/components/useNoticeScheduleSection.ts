import { useCallback, useMemo, useState } from 'react';
import { useT, type TranslationKey } from '@skkuverse/shared';
import {
  decideSchedulePhase,
  hasScheduleDetail,
  toScheduleDay,
  toScheduleTimeText,
  toScheduleWhen,
} from '../notice-schedule.rules';
import type {
  NoticeScheduleDay,
  NoticeScheduleEntry,
  NoticeScheduleItem,
  NoticeSchedulePhase,
  NoticeSchedulePointLabel,
  NoticeScheduleStatus,
  NoticeScheduleTenDays,
  NoticeScheduleWhen,
} from '../notice-schedule.types';

const MONTH_KEYS = [
  'notices.schedule.month1',
  'notices.schedule.month2',
  'notices.schedule.month3',
  'notices.schedule.month4',
  'notices.schedule.month5',
  'notices.schedule.month6',
  'notices.schedule.month7',
  'notices.schedule.month8',
  'notices.schedule.month9',
  'notices.schedule.month10',
  'notices.schedule.month11',
  'notices.schedule.month12',
] as const satisfies readonly TranslationKey[];

/** WHY: indexed by `Date.getUTCDay`, so Sunday is first. */
const WEEKDAY_KEYS = [
  'day.sun',
  'day.mon',
  'day.tue',
  'day.wed',
  'day.thu',
  'day.fri',
  'day.sat',
] as const satisfies readonly TranslationKey[];

const WEEK_ORDINAL_KEYS = [
  'notices.schedule.weekOrdinal1',
  'notices.schedule.weekOrdinal2',
  'notices.schedule.weekOrdinal3',
  'notices.schedule.weekOrdinal4',
] as const satisfies readonly TranslationKey[];

const STATUS_KEYS = {
  tentative: 'notices.schedule.status.tentative',
  rescheduled: 'notices.schedule.status.rescheduled',
  cancelled: 'notices.schedule.status.cancelled',
  suspended: 'notices.schedule.status.suspended',
} as const satisfies Partial<Record<NoticeScheduleStatus, TranslationKey>>;

const TEN_DAYS_KEYS = {
  early: 'notices.schedule.tenDays.early',
  mid: 'notices.schedule.tenDays.mid',
  late: 'notices.schedule.tenDays.late',
} as const satisfies Record<NoticeScheduleTenDays, TranslationKey>;

const META_SEPARATOR = ' · ';
const TEXT_SEPARATOR = ' ';

export interface NoticeScheduleMapTarget {
  skkuId: number;
  spaceCd: string | null;
}

export interface NoticeSchedulePartModel {
  id: string;
  title: string;
  meta: string | null;
  status: NoticeScheduleStatus;
  statusText: string | null;
  isStruck: boolean;
  mapTarget: NoticeScheduleMapTarget | null;
}

export interface NoticeScheduleRowModel {
  id: string;
  title: string;
  meta: string | null;
  phase: NoticeSchedulePhase;
  status: NoticeScheduleStatus;
  statusText: string | null;
  isStruck: boolean;
  isExpandable: boolean;
  isExpanded: boolean;
  occurrenceTexts: string[];
  moreText: string | null;
  exceptText: string | null;
  parts: NoticeSchedulePartModel[];
  mapTarget: NoticeScheduleMapTarget | null;
}

interface Inputs {
  schedule: readonly NoticeScheduleItem[];
  now: Date;
}

export function useNoticeScheduleSection({ schedule, now }: Inputs) {
  const { t, tpl } = useT();
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const rows = useMemo<NoticeScheduleRowModel[]>(() => {
    const dayText = (day: NoticeScheduleDay, withWeekday: boolean): string => {
      const monthDay = tpl('notices.schedule.dayOfMonth', t(MONTH_KEYS[day.month - 1]), day.day);
      const dated = day.year === null ? monthDay : tpl('notices.schedule.withYear', day.year, monthDay);
      return withWeekday ? tpl('notices.schedule.withWeekday', dated, t(WEEKDAY_KEYS[day.weekday])) : dated;
    };

    const monthText = (year: number | null, month: number): string => {
      const name = t(MONTH_KEYS[month - 1]);
      return year === null ? name : tpl('notices.schedule.withYear', year, name);
    };

    const pointText = (label: NoticeSchedulePointLabel, withWeekday: boolean): string => {
      switch (label.kind) {
        case 'relative':
          return label.day === 'today'
            ? t('notices.schedule.today')
            : label.day === 'tomorrow'
              ? t('notices.schedule.tomorrow')
              : t('notices.day.yesterday');
        case 'day':
          return dayText(label.date, withWeekday);
        case 'dayRange':
          return tpl('notices.schedule.range', dayText(label.from, false), dayText(label.to, false));
        case 'month':
          return monthText(label.year, label.month);
        case 'tenDays':
          return tpl(TEN_DAYS_KEYS[label.tenDays], monthText(label.year, label.month));
        case 'week':
          return tpl(
            'notices.schedule.weekOf',
            monthText(label.year, label.month),
            t(WEEK_ORDINAL_KEYS[label.week - 1]),
          );
        case 'lastWeek':
          return tpl('notices.schedule.lastWeekOf', monthText(label.year, label.month));
      }
    };


    const joined = (parts: readonly (string | null | undefined)[], separator: string): string | null => {
      const present = parts.filter((part): part is string => part !== null && part !== undefined && part !== '');
      return present.length > 0 ? present.join(separator) : null;
    };

    const timed = (dateText: string, time: string | null): string => joined([dateText, time], TEXT_SEPARATOR) ?? '';

    const whenText = (when: NoticeScheduleWhen): string => {
      switch (when.kind) {
        case 'range':
          return tpl(
            'notices.schedule.range',
            timed(pointText(when.from, false), when.fromTime),
            timed(pointText(when.to, false), when.toTime),
          );
        case 'deadline':
          return tpl('notices.schedule.until', timed(pointText(when.to, true), when.time));
        case 'at': {
          const { date } = when;
          if (date.kind !== 'repeat') return timed(pointText(date, true), when.time);
          const days =
            date.freq === 'daily'
              ? t('notices.schedule.repeatDaily')
              : tpl(
                  'notices.schedule.repeatWeekly',
                  date.weekdays.map((weekday) => t(WEEKDAY_KEYS[weekday])).join(t('notices.schedule.weekdaySeparator')),
                );
          const base = timed(days, when.time);
          return date.until === null
            ? base
            : tpl('notices.schedule.repeatWithUntil', base, tpl('notices.schedule.until', dayText(date.until, false)));
        }
      }
    };

    const statusText = (entry: NoticeScheduleEntry): string | null =>
      entry.status === 'scheduled' ? null : t(STATUS_KEYS[entry.status]);

    const isStruck = (entry: NoticeScheduleEntry): boolean => entry.status === 'cancelled' || entry.status === 'suspended';

    return schedule.map((item) => {
      const occurrenceTexts =
        item.occurrences.length > 1
          ? item.occurrences.map((occurrence) => whenText(toScheduleWhen(occurrence, now)))
          : [];
      const omitted = item.omittedCount ?? 0;
      return {
        id: item.id,
        title: item.title,
        meta: joined([whenText(toScheduleWhen(item, now)), item.place?.text], META_SEPARATOR),
        phase: decideSchedulePhase(item, now),
        status: item.status,
        statusText: statusText(item),
        isStruck: isStruck(item),
        isExpandable: hasScheduleDetail(item),
        isExpanded: expandedIds.has(item.id),
        occurrenceTexts,
        moreText: omitted > 0 ? tpl('notices.schedule.moreOccurrences', omitted) : null,
        exceptText:
          item.exdate !== undefined && item.exdate.length > 0
            ? tpl(
                'notices.schedule.except',
                item.exdate.map((date) => dayText(toScheduleDay(date, now), false)).join(', '),
              )
            : null,
        parts: (item.parts ?? []).map((part) => ({
          id: part.id,
          title: part.title,
          meta: joined(
            [
              part.rrule !== undefined || part.start?.date !== item.start?.date
                ? whenText(toScheduleWhen(part, now))
                : toScheduleTimeText(part),
              part.place?.text,
            ],
            META_SEPARATOR,
          ),
          status: part.status,
          statusText: statusText(part),
          isStruck: isStruck(part),
          mapTarget: part.place?.mapTarget ?? null,
        })),
        mapTarget: item.place?.mapTarget ?? null,
      };
    });
  }, [schedule, now, expandedIds, t, tpl]);

  return { rows, onToggle: toggle };
}
