import { z } from 'zod';
import { openEnum, tolerantArray } from '@skkuverse/shared';
import { AUDIENCE_LEVELS, AUDIENCE_STATUSES } from './notice-audience.constants';
import { hasNoticeAudience } from './notice-audience.rules';
import type { NoticeAudience } from './notice-audience.types';

function toKnownCodes<T extends string>(codes: readonly (T | undefined)[]): T[] {
  return [...new Set(codes.filter((code): code is T => code !== undefined))];
}

const audienceSchema = z.object({
  level: z.object({ include: tolerantArray(openEnum(AUDIENCE_LEVELS), 'notices.detail.audience.level').transform(toKnownCodes) }),
  status: z.object({
    include: tolerantArray(openEnum(AUDIENCE_STATUSES), 'notices.detail.audience.status').transform(toKnownCodes),
    exclude: tolerantArray(openEnum(AUDIENCE_STATUSES), 'notices.detail.audience.exclude').transform(toKnownCodes),
  }),
});

/** WHY: a missing, unreadable or empty audience reads as none and never fails the notice; an unknown code drops that code alone. */
export const noticeAudienceSchema = audienceSchema
  .nullable()
  .catch(null)
  .transform(
    (audience): NoticeAudience | null =>
      audience !== null && hasNoticeAudience(audience) ? audience : null,
  );
