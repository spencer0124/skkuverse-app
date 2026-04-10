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

export interface NoticeListItemSummary {
  oneLiner: string | null;
  type: NoticeSummaryType;
  endDate: string | null;
  endTime: string | null;
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
  /** Specific building/room/address. `null` if vague (online, anywhere). */
  location: string | null;
  /** Organizer / sponsor. */
  host: string | null;
  /** Impact, benefit, or alternative options for the reader. */
  impact: string | null;
}

export interface NoticeDetailSummary {
  text: string | null;
  oneLiner: string | null;
  type: NoticeSummaryType;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
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
  contentHtml: string | null;
  contentText: string | null;
  attachments: NoticeAttachment[];
  sourceUrl: string;
  lastModified: string | null;
  crawledAt: string;
  editInfo: NoticeEditInfo | null;
  summary: NoticeDetailSummary | null;
}
