import { useCallback, useMemo, useState } from 'react';
import { useT, type TranslationKey } from '@skkuverse/shared';
import {
  decideSchedulePhase,
  hasScheduleDetail,
  toScheduleDateLabel,
  toScheduleDay,
  toScheduleTimeText,
} from '../notice-schedule.rules';
import type {
  NoticeScheduleDateLabel,
  NoticeScheduleDay,
  NoticeScheduleEntry,
  NoticeScheduleItem,
  NoticeSchedulePhase,
  NoticeSchedulePointLabel,
  NoticeScheduleStatus,
  NoticeScheduleTenDays,
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
  dateText: string;
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

    const labelText = (label: NoticeScheduleDateLabel): string => {
      switch (label.kind) {
        case 'range':
          return tpl('notices.schedule.range', pointText(label.from, false), pointText(label.to, false));
        case 'deadline':
          return tpl('notices.schedule.until', pointText(label.to, true));
        case 'repeat': {
          const base =
            label.freq === 'daily'
              ? t('notices.schedule.repeatDaily')
              : tpl(
                  'notices.schedule.repeatWeekly',
                  label.weekdays.map((weekday) => t(WEEKDAY_KEYS[weekday])).join(t('notices.schedule.weekdaySeparator')),
                );
          return label.until === null
            ? base
            : tpl('notices.schedule.repeatWithUntil', base, tpl('notices.schedule.until', dayText(label.until, false)));
        }
        default:
          return pointText(label, true);
      }
    };

    const joined = (parts: readonly (string | null | undefined)[], separator: string): string | null => {
      const present = parts.filter((part): part is string => part !== null && part !== undefined && part !== '');
      return present.length > 0 ? present.join(separator) : null;
    };

    const statusText = (entry: NoticeScheduleEntry): string | null =>
      entry.status === 'scheduled' ? null : t(STATUS_KEYS[entry.status]);

    const isStruck = (entry: NoticeScheduleEntry): boolean => entry.status === 'cancelled' || entry.status === 'suspended';

    return schedule.map((item) => {
      const occurrenceTexts =
        item.occurrences.length > 1
          ? item.occurrences.map(
              (occurrence) =>
                joined(
                  [labelText(toScheduleDateLabel(occurrence, now)), toScheduleTimeText(occurrence)],
                  TEXT_SEPARATOR,
                ) ?? '',
            )
          : [];
      const omitted = item.omittedCount ?? 0;
      return {
        id: item.id,
        dateText: labelText(toScheduleDateLabel(item, now)),
        title: item.title,
        meta: joined([toScheduleTimeText(item), item.place?.text], META_SEPARATOR),
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
                ? labelText(toScheduleDateLabel(part, now))
                : null,
              toScheduleTimeText(part),
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
