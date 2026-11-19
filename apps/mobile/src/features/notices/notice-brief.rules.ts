import { KST_OFFSET_MS } from '@skkuverse/shared';
import type { ContentRefs } from './content-refs.rules';
import { diffDays, formatDisplayDate, formatListDate, startOfLocalDay } from './notice-date.rules';
import type { NoticeBrief, NoticeBriefAttachment, NoticeBriefBody } from './notice-brief.types';
import type { NoticeDetail } from './notices.types';

export type NoticeBriefAge =
  | { kind: 'justNow' }
  | { kind: 'minutes'; count: number }
  | { kind: 'hours'; count: number }
  | { kind: 'yesterday' }
  | { kind: 'date'; label: string };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const KST_DATE_LENGTH = 10;

function toKstDate(ms: number): string {
  return new Date(startOfLocalDay(new Date(ms)) + KST_OFFSET_MS).toISOString().slice(0, KST_DATE_LENGTH);
}

export function toNoticeBriefAge(firstSeenAt: string, now: Date): NoticeBriefAge {
  const seen = Date.parse(firstSeenAt);
  if (Number.isNaN(seen)) return { kind: 'date', label: '' };
  const elapsed = Math.max(0, now.getTime() - seen);
  const days = diffDays(startOfLocalDay(new Date(seen)), startOfLocalDay(now));
  if (days <= 0) {
    if (elapsed < MINUTE_MS) return { kind: 'justNow' };
    if (elapsed < HOUR_MS) return { kind: 'minutes', count: Math.floor(elapsed / MINUTE_MS) };
    return { kind: 'hours', count: Math.floor(elapsed / HOUR_MS) };
  }
  if (days === 1) return { kind: 'yesterday' };
  const date = toKstDate(seen);
  const sameYear = date.slice(0, 4) === toKstDate(now.getTime()).slice(0, 4);
  return { kind: 'date', label: sameYear ? formatListDate(date) : formatDisplayDate(date) };
}

/** WHY: `postedAt` is a KST day, sent as a bare date or as KST midnight; either reads as the same calendar day here. */
export function toPostedMonthDay(postedAt: string): { month: number; day: number } | null {
  const ms = Date.parse(postedAt);
  if (Number.isNaN(ms)) return null;
  const [, month, day] = toKstDate(ms).split('-').map(Number);
  return { month, day };
}

export function sortFormsFirst(attachments: readonly NoticeBriefAttachment[]): NoticeBriefAttachment[] {
  return [...attachments.filter((a) => a.isForm), ...attachments.filter((a) => !a.isForm)];
}

export function hasNoticeBriefRefs(brief: NoticeBrief): boolean {
  const { refs } = brief;
  return (
    refs.attachments.length > 0 ||
    refs.links.length > 0 ||
    refs.phones.length > 0 ||
    refs.emails.length > 0
  );
}

export function toFullBodyMarkdown(body: NoticeBriefBody): string | null {
  const posters = body.posters.map((poster) =>
    poster.width && poster.height ? `![{${poster.width}x${poster.height}}](${poster.url})` : `![](${poster.url})`,
  );
  const parts = [...posters, body.markdown ?? ''].filter((part) => part.trim().length > 0);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

export function findNoticeBrief(
  briefs: readonly NoticeBrief[],
  sourceId: string,
  articleNo: number,
): NoticeBrief | null {
  return briefs.find((brief) => brief.id === `${sourceId}-${articleNo}`) ?? null;
}

export interface ToNoticeBriefInputs {
  notice: NoticeDetail;
  boardName: string | null;
  refs: ContentRefs;
}

/** WHY: until the server sends the brief, a live notice still opens in this layout, with no bullets. */
export function toNoticeBrief({ notice, boardName, refs }: ToNoticeBriefInputs): NoticeBrief {
  return {
    id: `${notice.sourceId}-${notice.articleNo}`,
    title: notice.title,
    source: {
      boardName: boardName ?? notice.department ?? '',
      postedAt: notice.date,
      firstSeenAt: notice.crawledAt,
      isEdited: (notice.editInfo?.count ?? 0) > 0,
      url: notice.sourceUrl,
    },
    answer: { question: null, bullets: [] },
    body: { markdown: notice.contentMarkdown, posters: [] },
    refs: {
      attachments: notice.attachments.map((a) => ({ name: a.name, url: a.url, isForm: false })),
      links: refs.links.map((link) => ({ url: link.url, domain: link.domain })),
      phones: refs.phones.map((number) => ({ number, label: null })),
      emails: refs.emails.map((address) => ({ address, label: null })),
    },
  };
}
