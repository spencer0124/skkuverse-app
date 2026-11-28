import type { NoticeRefs } from './notice-refs.types';

export function hasNoticeRefs(refs: NoticeRefs): boolean {
  return refs.links.length > 0 || refs.phones.length > 0 || refs.emails.length > 0;
}

/** WHY: a link opens on the web alone, so anything that is not already http or https is read as a bare host. */
export function toLinkHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function toTelHref(value: string): string {
  return `tel:${value.trim().startsWith('+') ? '+' : ''}${value.replace(/\D/g, '')}`;
}

export function toMailtoHref(value: string): string {
  return `mailto:${value.trim()}`;
}
