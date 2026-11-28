import { z } from 'zod';
import { openEnum, tolerantArray } from '@skkuverse/shared';
import { BRIEF_LANGUAGES } from './notice-brief.constants';
import type { NoticeBriefAnswer } from './notice-brief.types';

/** WHY: today's server sends `{ question, bullets }` and the next wire `{ language, bullets, version }`; both read here, and no question shows. */
const briefSchema = z.object({
  language: openEnum(BRIEF_LANGUAGES),
  bullets: tolerantArray(z.object({ text: z.string() }), 'notices.detail.brief.bullets'),
});

/**
 * WHY: a payload that is no brief, or an older server's missing field, reads as no brief and never fails the notice;
 * a bullet this build cannot read is dropped and reported alone.
 */
export const noticeBriefSchema = briefSchema
  .nullable()
  .catch(null)
  .transform(
    (brief): NoticeBriefAnswer | null =>
      brief && { language: brief.language ?? null, bullets: brief.bullets },
  );
