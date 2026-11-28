import { z } from 'zod';
import { text, tolerantArray } from '@skkuverse/shared';
import { hasNoticeRefs, toUniqueEmails, toUniquePhones } from './notice-refs.rules';
import type { NoticeRefs } from './notice-refs.types';

const refsSchema = z.object({
  links: tolerantArray(z.object({ url: text, domain: text }), 'notices.detail.refs.links'),
  phones: tolerantArray(z.object({ value: text.regex(/\d/) }), 'notices.detail.refs.phones').transform(toUniquePhones),
  emails: tolerantArray(z.object({ value: text }), 'notices.detail.refs.emails').transform(toUniqueEmails),
});

/**
 * WHY: `undefined` stays apart from `null`: today's server sends no `refs` key, and the detail then falls back to
 * the body's refs, while `null` from the next wire means the notice has none. An unreadable block reads as none.
 */
export const noticeRefsSchema = refsSchema
  .nullable()
  .catch(null)
  .transform((refs): NoticeRefs | null => (refs !== null && hasNoticeRefs(refs) ? refs : null))
  .optional();
