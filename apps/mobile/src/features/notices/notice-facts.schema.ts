// CONTRACT(skkuverse-server): skkuverse-server/contracts/produced/notices-list.noticeList.schema.json; a malformed row
// reads as null, so its notice keeps today's row rather than dropping.
import { z } from 'zod';
import { openEnum, optionalText, parsedBy, text } from '@skkuverse/shared';
import {
  NOTICE_LIST_ROW_DATE_MARKS,
  NOTICE_LIST_ROW_DAYS,
  NOTICE_LIST_ROW_TONES,
  type NoticeListRow,
  type NoticeListRowToken,
} from './notice-facts.types';

// WHY: a missing or non-list field reads as an empty list, as the hand parser read it.
export const listOrEmpty = parsedBy((raw) => (Array.isArray(raw) ? raw : []));

export function nullOr<S extends z.ZodType>(objectSchema: S) {
  return z.union([z.null(), z.undefined()]).transform(() => null).or(objectSchema);
}

const flag = z.boolean().catch(false);
const textOrNull = optionalText.transform((value) => value ?? null);

const rowTokenSchema = z
  .object({ text, tone: openEnum(NOTICE_LIST_ROW_TONES) })
  .transform(({ text: tokenText, tone }): NoticeListRowToken => ({ text: tokenText, tone: tone ?? null }));

export const noticeListRowSchema = nullOr(
  z
    .object({
      token: nullOr(rowTokenSchema).catch(null),
      title: text,
      when: textOrNull,
      urgent: flag,
      dateMark: openEnum(NOTICE_LIST_ROW_DATE_MARKS).transform((mark) => mark ?? null),
      qualifier: textOrNull,
      board: textOrNull,
      dimmed: flag,
      day: openEnum(NOTICE_LIST_ROW_DAYS).transform((day) => day ?? null),
    })
    .transform(({ urgent, dimmed, ...row }): NoticeListRow => ({ ...row, isUrgent: urgent, isDimmed: dimmed })),
).catch(null);
