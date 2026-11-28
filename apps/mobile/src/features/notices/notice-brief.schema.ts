import { z } from 'zod';
import { tolerantArray } from '@skkuverse/shared';
import { BRIEF_LANGUAGES } from './notice-brief.constants';
import type { NoticeBriefAnswer } from './notice-brief.types';

const briefSchema = z.object({
  language: z.string().transform((language) => BRIEF_LANGUAGES.find((known) => known === language) ?? null),
  bullets: tolerantArray(z.object({ text: z.string() }), 'notices.detail.brief.bullets'),
  version: z.string(),
});

/**
 * WHY: a payload that is no brief reads as no brief and never fails the notice;
 * a bullet this build cannot read is dropped and reported alone.
 */
export const noticeBriefSchema = briefSchema
  .nullable()
  .catch(null)
  .transform(
    (brief): NoticeBriefAnswer | null =>
      brief && { language: brief.language, bullets: brief.bullets },
  );
