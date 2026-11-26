// CONTRACT(skkuverse-server): skkuverse-server/src/notices/detail/notices-detail.wire.ts (`noticeScheduleItem`) writes this shape.
import { z } from 'zod';
import { tolerantArray } from '@skkuverse/shared';
import {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_PRECISIONS,
  SCHEDULE_STATUSES,
  SCHEDULE_WEEKDAYS,
} from './notice-schedule.constants';
import type { NoticeScheduleItem } from './notice-schedule.types';

/** WHY: `openEnum` lets an unknown value through as `undefined`, and here an unknown status or precision would show wrongly, so the item is refused and dropped instead. */
function oneOf<const V extends readonly string[]>(values: V) {
  return z.custom<V[number]>((value) => typeof value === 'string' && values.includes(value));
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const point = z.object({ date: isoDate, time: z.string().optional() });

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: point,
  end: point.optional(),
  precision: oneOf(SCHEDULE_PRECISIONS).optional(),
  repeat: z
    .object({
      freq: oneOf(SCHEDULE_FREQUENCIES),
      byDay: tolerantArray(oneOf(SCHEDULE_WEEKDAYS), 'notices.detail.schedule.byDay').optional(),
      until: isoDate.optional(),
    })
    .optional(),
  except: tolerantArray(isoDate, 'notices.detail.schedule.except'),
  slots: tolerantArray(
    z.object({ start: point, end: point.optional(), text: z.string() }),
    'notices.detail.schedule.slots',
  ),
  status: oneOf(SCHEDULE_STATUSES),
  quote: z.string().optional(),
  place: z
    .object({
      text: z.string(),
      name: z.string().nullable(),
      mapTarget: z.object({ skkuId: z.number(), spaceCd: z.string().nullable() }).nullable(),
    })
    .optional(),
});

/**
 * WHY: an item this build cannot read (an unknown status, a malformed day) is dropped and reported alone;
 * a payload that is no list, or an older server's missing field, reads as no timeline and never fails the notice.
 */
export const noticeScheduleSchema = tolerantArray(itemSchema, 'notices.detail.schedule')
  .nullable()
  .catch(null)
  .transform((items): NoticeScheduleItem[] | null => items);
