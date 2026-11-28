import { KST_OFFSET_MS } from '@skkuverse/shared';
import { isImageAttachment } from './attachment.rules';
import { formatDisplayDate, startOfLocalDay } from './notice-date.rules';
import type { NoticeBrief, NoticeBriefBody, NoticeBriefPart, NoticeBriefPartSlot } from './notice-brief.types';
import type { NoticeDetail } from './notices.types';

const KST_DATE_LENGTH = 10;

function toKstDate(ms: number): string {
  return new Date(startOfLocalDay(new Date(ms)) + KST_OFFSET_MS).toISOString().slice(0, KST_DATE_LENGTH);
}

/** WHY: `postedAt` is a KST day, sent as a bare date or as KST midnight; either reads as the same calendar day here. */
function toPostedKstDate(postedAt: string): string | null {
  const ms = Date.parse(postedAt);
  return Number.isNaN(ms) ? null : toKstDate(ms);
}

function toMonthDay(kstDate: string): { month: number; day: number } {
  const [, month, day] = kstDate.split('-').map(Number);
  return { month, day };
}

export function toPostedMonthDay(postedAt: string): { month: number; day: number } | null {
  const date = toPostedKstDate(postedAt);
  return date === null ? null : toMonthDay(date);
}

export type PostedDateLabel =
  | { kind: 'thisYear'; month: number; day: number }
  | { kind: 'otherYear'; label: string };

export function toPostedDateLabel(postedAt: string, now: Date): PostedDateLabel | null {
  const date = toPostedKstDate(postedAt);
  if (date === null) return null;
  const isThisYear = date.slice(0, 4) === toKstDate(now.getTime()).slice(0, 4);
  return isThisYear ? { kind: 'thisYear', ...toMonthDay(date) } : { kind: 'otherYear', label: formatDisplayDate(date) };
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

/** WHY: the way to the full text follows the bullets when there are some, and closes the page when there are none. */
export function hasViewAllUnderBullets(brief: NoticeBrief, hasFullBody: boolean): boolean {
  return hasFullBody && brief.answer !== null;
}

/**
 * WHY: the audience and the timeline read as one block under the title, so no divider parts them; the image
 * attachments ride under the bullets, or take the full text's place at the end when there are none.
 */
export function toNoticeBriefParts(brief: NoticeBrief, hasFullBody: boolean): NoticeBriefPartSlot[] {
  const shown: Record<NoticeBriefPart, boolean> = {
    audience: brief.audience !== null,
    schedule: brief.schedule !== null && brief.schedule.length > 0,
    bullets: brief.answer !== null,
    refs: hasNoticeBriefRefs(brief),
    body: brief.answer === null && (brief.images.length > 0 || hasFullBody),
  };
  const order: NoticeBriefPart[] = ['audience', 'schedule', 'bullets', 'refs', 'body'];
  const parts = order.filter((part) => shown[part]);
  return parts.map((part, index) => ({
    part,
    hasDividerBefore: index > 0 && !(part === 'schedule' && parts[index - 1] === 'audience'),
  }));
}

export function toFullBodyMarkdown(body: NoticeBriefBody): string | null {
  return body.markdown !== null && body.markdown.trim().length > 0 ? body.markdown : null;
}

export interface ToNoticeBriefInputs {
  notice: NoticeDetail;
  boardName: string | null;
}

/** WHY: a brief with no bullets reads as none; the server sends null for it too. */
function toAnswer(brief: NoticeDetail['brief']): NoticeBrief['answer'] {
  return brief !== null && brief.bullets.length > 0 ? brief : null;
}

export function toNoticeBrief({ notice, boardName }: ToNoticeBriefInputs): NoticeBrief {
  return {
    id: `${notice.sourceId}-${notice.articleNo}`,
    title: notice.title,
    source: {
      boardName: boardName ?? notice.department ?? '',
      postedAt: notice.date,
      isEdited: (notice.editInfo?.count ?? 0) > 0,
      url: notice.sourceUrl,
    },
    answer: toAnswer(notice.brief),
    audience: notice.audience,
    body: { markdown: notice.contentMarkdown },
    images: notice.attachments.filter(isImageAttachment).map(({ name, url }) => ({ name, url })),
    schedule: notice.schedule,
    refs: {
      attachments: notice.attachments.map(({ name, url }) => ({ name, url })),
      links: notice.refs?.links ?? [],
      phones: notice.refs?.phones ?? [],
      emails: notice.refs?.emails ?? [],
    },
  };
}
