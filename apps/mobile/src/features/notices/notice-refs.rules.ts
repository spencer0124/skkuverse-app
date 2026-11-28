import { extractContentRefs } from './content-refs.rules';
import type { NoticeRefContact, NoticeRefs } from './notice-refs.types';

export function hasNoticeRefs(refs: NoticeRefs): boolean {
  return refs.links.length > 0 || refs.phones.length > 0 || refs.emails.length > 0;
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function uniqueBy(contacts: readonly NoticeRefContact[], keyOf: (value: string) => string): NoticeRefContact[] {
  const seen = new Set<string>();
  return contacts.filter(({ value }) => {
    const key = keyOf(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** WHY: one number written two ways (`02-740-1724`, `02.740.1724`) is one row. */
export function toUniquePhones(phones: readonly NoticeRefContact[]): NoticeRefContact[] {
  return uniqueBy(phones, phoneDigits);
}

export function toUniqueEmails(emails: readonly NoticeRefContact[]): NoticeRefContact[] {
  return uniqueBy(emails, (value) => value.trim().toLowerCase());
}

/** WHY: holds until the server sends `refs`: a server without the field still shows the links, phones and emails found in the body. */
export function toBodyRefs(markdown: string | null, attachmentUrls: readonly string[]): NoticeRefs | null {
  const found = extractContentRefs(markdown, attachmentUrls);
  const refs: NoticeRefs = {
    links: found.links.map(({ url, domain }) => ({ url, domain })),
    phones: found.phones.map((value) => ({ value })),
    emails: found.emails.map((value) => ({ value })),
  };
  return hasNoticeRefs(refs) ? refs : null;
}

/** WHY: a link opens on the web alone, so anything that is not already http or https is read as a bare host. */
export function toLinkHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function toTelHref(value: string): string {
  return `tel:${value.trim().startsWith('+') ? '+' : ''}${phoneDigits(value)}`;
}

export function toMailtoHref(value: string): string {
  return `mailto:${value.trim()}`;
}
