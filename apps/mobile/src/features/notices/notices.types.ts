/** CONTRACT(skkuverse-server): skkuverse-server/docs/reference/notices-api.md */
import type { NoticeListRow } from './notice-facts.types';

export type NoticeSummaryType =
  | 'action_required'
  | 'event'
  | 'informational';

export interface NoticeSource {
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
  sourceId: string;
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
  row: NoticeListRow | null;
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
  target: string | null;
  action: string | null;
  host: string | null;
  impact: string | null;
}

export interface NoticePeriod {
  label: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
}

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

/** WHY: only keys whose copy is also bundled as an old-server fallback; the server ships copy for new keys. */
export type ExcludeReasonKey =
  | 'loginRequired'
  | 'noWebsite'
  | 'externalSystem'
  | 'accessRestricted'
  | 'temporarilyUnavailable';

export interface TabSource {
  id: string;
  name: string;
  campus: string | null;
  college: string | null;
  noticeAvailable: boolean;
  /** WHY: a plain string, not ExcludeReasonKey: the server may add keys this build does not know. */
  excludeReason: string | null;
  /** WHY: null from servers older than the field. */
  excludeReasonText: string | null;
}

export interface PickerTabConfig {
  sources: TabSource[];
  maxSelection: number;
  defaultIds: string[];
  campusDefaultIds: { hssc: string[]; nsc: string[] };
}

export interface FixedTabConfig {
  sourceId: string;
  name: string;
  campus: string;
}

export interface NoticeTab {
  key: string;
  label: string;
  tabMode: 'picker' | 'fixed';
  picker?: PickerTabConfig;
  fixed?: FixedTabConfig;
}

export interface NoticeTabsConfig {
  schemaVersion: number;
  tabs: NoticeTab[];
}

export interface NoticeDetail {
  id: string;
  sourceId: string;
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
