/**
 * Notice feature types.
 *
 * Mirrors skkuverse-server response shapes documented in
 * `skkuverse-server/doc/notices-api-architecture.md`.
 */

export type NoticeSummaryType =
  | 'action_required'
  | 'event'
  | 'informational';

export interface Department {
  id: string;
  name: string;
  campus: string | null;
  category: string | null;
  hasCategory: boolean;
  hasAuthor: boolean;
}

export interface NoticeStartAt {
  date: string | null;
  time: string | null;
}

export interface NoticeEndAt {
  date: string | null;
  time: string | null;
  label: string | null;
}

export interface NoticeListItemSummary {
  oneLiner: string | null;
  type: NoticeSummaryType;
  startAt: NoticeStartAt | null;
  endAt: NoticeEndAt | null;
}

export interface NoticeListItem {
  id: string;
  deptId: string;
  articleNo: number;
  title: string;
  category: string | null;
  author: string | null;
  department: string | null;
  date: string;
  views: number;
  sourceUrl: string;
  hasContent: boolean;
  hasAttachments: boolean;
  isEdited: boolean;
  summary: NoticeListItemSummary | null;
}

export interface NoticePage {
  notices: NoticeListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface NoticeAttachment {
  name: string;
  url: string;
}

export interface NoticeEditInfo {
  count: number;
  history: unknown[];
}

export interface NoticeSummaryDetails {
  /** Who the notice applies to. `null` if generic / not stated. */
  target: string | null;
  /** What the reader is expected to do. `null` if no concrete action. */
  action: string | null;
  /** Organizer / sponsor. */
  host: string | null;
  /** Impact, benefit, or alternative options for the reader. */
  impact: string | null;
}

/**
 * One temporal phase of a notice. Multi-phase notices (e.g. 1차/2차 납부)
 * contribute multiple periods; `label` is null when there's only one period,
 * and a short AI-generated disambiguator ("1차 납부") when there are 2+.
 */
export interface NoticePeriod {
  label: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
}

/**
 * A concrete location for a notice. `detail` is a non-empty string
 * (building/room/address). `label` is null for a single location and
 * a short AI-generated disambiguator ("인사캠") when there are 2+.
 */
export interface NoticeLocation {
  label: string | null;
  detail: string;
}

export interface NoticeDetailSummary {
  text: string | null;
  oneLiner: string | null;
  type: NoticeSummaryType;
  periods: NoticePeriod[];
  locations: NoticeLocation[];
  details: NoticeSummaryDetails | null;
  model: string | null;
  generatedAt: string;
}

export interface NoticeDetail {
  id: string;
  deptId: string;
  articleNo: number;
  title: string;
  category: string | null;
  author: string | null;
  department: string | null;
  date: string;
  views: number;
  contentMarkdown: string | null;
  attachments: NoticeAttachment[];
  sourceUrl: string;
  lastModified: string | null;
  crawledAt: string;
  editInfo: NoticeEditInfo | null;
  summary: NoticeDetailSummary | null;
}
