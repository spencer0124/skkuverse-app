import { z } from 'zod';
import { text, tolerantArray } from '@skkuverse/shared';
import { hasNoticeRefs } from './notice-refs.rules';
import type { NoticeRefs } from './notice-refs.types';

const refsSchema = z.object({
  links: tolerantArray(z.object({ url: text, domain: text }), 'notices.detail.refs.links'),
  phones: tolerantArray(z.object({ value: text }), 'notices.detail.refs.phones'),
  emails: tolerantArray(z.object({ value: text }), 'notices.detail.refs.emails'),
});

/** WHY: a missing, null or unreadable block reads as none and never fails the notice. */
export const noticeRefsSchema = refsSchema
  .nullable()
  .catch(null)
  .transform((refs): NoticeRefs | null => (refs !== null && hasNoticeRefs(refs) ? refs : null));
