// CONTRACT(skkuverse-server): skkuverse-server/src/notices/detail/notices-detail.wire.ts (`noticeBrief`) writes this shape.
import { z } from 'zod';
import { tolerantArray } from '@skkuverse/shared';
import type { NoticeBriefAnswer } from './notice-brief.types';

const briefSchema = z.object({
  question: z.string().nullable(),
  bullets: tolerantArray(z.object({ text: z.string() }), 'notices.detail.brief.bullets'),
});

/**
 * WHY: a payload that is no brief, or an older server's missing field, reads as no brief and never fails the notice;
 * a bullet this build cannot read is dropped and reported alone.
 */
export const noticeBriefSchema = briefSchema
  .nullable()
  .catch(null)
  .transform((brief): NoticeBriefAnswer | null => brief);
