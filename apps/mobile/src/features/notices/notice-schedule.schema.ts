// CONTRACT(skkuverse-server): skkuverse-server/src/notices/notices.wire.ts (`noticeScheduleItem`) writes this shape; the app reads the part it draws and leaves `rdate`, `gaps` and the rest to `occurrences`.
import { z } from 'zod';
import { tolerantArray } from '@skkuverse/shared';
import { SCHEDULE_FREQUENCIES, SCHEDULE_STATUSES, SCHEDULE_WEEKDAYS } from './notice-schedule.constants';
import type { NoticeScheduleItem } from './notice-schedule.types';

/** WHY: `openEnum` lets an unknown value through as `undefined`, and here an unknown status would show wrongly, so the item is refused and dropped instead. */
function oneOf<const V extends readonly string[]>(values: V) {
  return z.custom<V[number]>((value) => typeof value === 'string' && values.includes(value));
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const point = z.object({ date: isoDate, time: z.string().optional(), latest: isoDate.optional() });
const span = { start: point.optional(), end: point.optional() };

const entryShape = {
  id: z.string(),
  title: z.string(),
  status: oneOf(SCHEDULE_STATUSES),
  ...span,
  rrule: z
    .object({
      freq: oneOf(SCHEDULE_FREQUENCIES),
      byDay: tolerantArray(oneOf(SCHEDULE_WEEKDAYS), 'notices.detail.schedule.byDay').optional(),
      until: isoDate.optional(),
    })
    .optional(),
  exdate: tolerantArray(isoDate, 'notices.detail.schedule.exdate').optional(),
  place: z
    .object({
      text: z.string(),
      name: z.string().nullable(),
      mapTarget: z.object({ skkuId: z.number(), spaceCd: z.string().nullable() }).nullable(),
    })
    .optional(),
  occurrences: tolerantArray(z.object(span), 'notices.detail.schedule.occurrences'),
  omittedCount: z.number().int().min(0).nullable(),
};

/** WHY: an item with no day to draw, or a series with no first day, is a stored mistake, so it is dropped like an unreadable one. */
function hasDay(entry: { start?: unknown; end?: unknown; rrule?: unknown }): boolean {
  return entry.start !== undefined || (entry.end !== undefined && entry.rrule === undefined);
}

const entrySchema = z.object(entryShape).refine(hasDay);
const itemSchema = z
  .object({ ...entryShape, parts: tolerantArray(entrySchema, 'notices.detail.schedule.parts').optional() })
  .refine(hasDay);

/**
 * WHY: an item this build cannot read (an unknown status, a malformed day, a v1 item with no `occurrences`) is dropped and reported alone;
 * a payload that is no list, an empty one or an older server's missing field reads as no timeline and never fails the notice.
 */
export const noticeScheduleSchema = tolerantArray(itemSchema, 'notices.detail.schedule')
  .nullable()
  .catch(null)
  .transform((items): NoticeScheduleItem[] | null => (items === null || items.length === 0 ? null : items));
