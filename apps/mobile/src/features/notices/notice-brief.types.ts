import type { BRIEF_LANGUAGES } from './notice-brief.constants';
import type { NoticeAudience } from './notice-audience.types';
import type { NoticeRefContact, NoticeRefLink } from './notice-refs.types';
import type { NoticeScheduleItem } from './notice-schedule.types';

export type NoticeBriefLanguage = (typeof BRIEF_LANGUAGES)[number];

export interface NoticeBriefSource {
  boardName: string;
  postedAt: string;
  isEdited: boolean;
  url: string;
}

export interface NoticeBriefAnswer {
  /** WHY: the notice's language, not the reader's, so a screen reader speaks the bullets in it. */
  language: NoticeBriefLanguage | null;
  bullets: { text: string }[];
}

export interface NoticeBriefPoster {
  url: string;
  width: number | null;
  height: number | null;
}

export interface NoticeBriefBody {
  markdown: string | null;
  posters: NoticeBriefPoster[];
}

export interface NoticeBriefAttachment {
  name: string;
  url: string;
}

export interface NoticeBriefRefs {
  attachments: NoticeBriefAttachment[];
  links: NoticeRefLink[];
  phones: NoticeRefContact[];
  emails: NoticeRefContact[];
}

export interface NoticeBrief {
  id: string;
  title: string;
  source: NoticeBriefSource;
  answer: NoticeBriefAnswer | null;
  audience: NoticeAudience | null;
  body: NoticeBriefBody;
  schedule: NoticeScheduleItem[] | null;
  refs: NoticeBriefRefs;
}

export type NoticeBriefPart = 'audience' | 'schedule' | 'bullets' | 'refs' | 'body';

export interface NoticeBriefPartSlot {
  part: NoticeBriefPart;
  hasDividerBefore: boolean;
}
