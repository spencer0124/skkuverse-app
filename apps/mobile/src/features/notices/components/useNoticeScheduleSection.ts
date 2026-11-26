import { useCallback, useMemo, useState } from 'react';
import { useT, type TranslationKey } from '@skkuverse/shared';
import {
  decideSchedulePhase,
  hasScheduleDetail,
  sortNoticeSchedule,
  toScheduleDateLabel,
  toScheduleDay,
  toScheduleTimeText,
} from '../notice-schedule.rules';
import type {
  NoticeScheduleDateLabel,
  NoticeScheduleDay,
  NoticeScheduleItem,
  NoticeSchedulePhase,
  NoticeScheduleStatus,
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
  'notices.schedule.weekOrdinal5',
] as const satisfies readonly TranslationKey[];

const STATUS_KEYS = {
  tentative: 'notices.schedule.status.tentative',
  rescheduled: 'notices.schedule.status.rescheduled',
  cancelled: 'notices.schedule.status.cancelled',
  suspended: 'notices.schedule.status.suspended',
} as const satisfies Partial<Record<NoticeScheduleStatus, TranslationKey>>;

const META_SEPARATOR = ' · ';

export interface NoticeScheduleMapTarget {
  skkuId: number;
  spaceCd: string | null;
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
  slots: string[];
  quote: string | null;
  exceptText: string | null;
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

    const labelText = (label: NoticeScheduleDateLabel): string => {
      switch (label.kind) {
        case 'relative':
          return label.day === 'today'
            ? t('notices.schedule.today')
            : label.day === 'tomorrow'
              ? t('notices.schedule.tomorrow')
              : t('notices.day.yesterday');
        case 'day':
          return dayText(label.date, true);
        case 'range':
          return tpl('notices.schedule.range', dayText(label.from, false), dayText(label.to, false));
        case 'month':
          return monthText(label.year, label.month);
        case 'week':
          return tpl(
            'notices.schedule.weekOf',
            monthText(label.year, label.month),
            t(WEEK_ORDINAL_KEYS[label.week - 1]),
          );
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
      }
    };

    return sortNoticeSchedule(schedule).map((item) => {
      const timeText = toScheduleTimeText(item);
      const meta = [timeText, item.place?.text ?? null].filter((part): part is string => part !== null && part !== '');
      const statusKey = item.status === 'scheduled' ? null : STATUS_KEYS[item.status];
      return {
        id: item.id,
        dateText: labelText(toScheduleDateLabel(item, now)),
        title: item.title,
        meta: meta.length > 0 ? meta.join(META_SEPARATOR) : null,
        phase: decideSchedulePhase(item, now),
        status: item.status,
        statusText: statusKey === null ? null : t(statusKey),
        isStruck: item.status === 'cancelled' || item.status === 'suspended',
        isExpandable: hasScheduleDetail(item),
        isExpanded: expandedIds.has(item.id),
        slots: item.slots.map((slot) => slot.text),
        quote: item.quote ?? null,
        exceptText:
          item.except.length > 0
            ? tpl(
                'notices.schedule.except',
                item.except.map((date) => dayText(toScheduleDay(date, now), false)).join(', '),
              )
            : null,
        mapTarget: item.place?.mapTarget ?? null,
      };
    });
  }, [schedule, now, expandedIds, t, tpl]);

  return { rows, onToggle: toggle };
}
