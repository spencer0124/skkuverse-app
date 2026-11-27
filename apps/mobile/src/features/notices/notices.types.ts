/** CONTRACT(skkuverse-server): skkuverse-server/docs/reference/notices-api.md */
import type { NoticeBriefAnswer } from './notice-brief.types';
import type { NoticeScheduleItem } from './notice-schedule.types';

export interface NoticeSource {
  id: string;
  name: string;
  campus: string | null;
  category: string | null;
  hasCategory: boolean;
  hasAuthor: boolean;
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
  sourceUrl: string;
  hasContent: boolean;
  hasAttachments: boolean;
  isEdited: boolean;
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
  contentMarkdown: string | null;
  attachments: NoticeAttachment[];
  sourceUrl: string;
  lastModified: string | null;
  crawledAt: string;
  editInfo: NoticeEditInfo | null;
  schedule: NoticeScheduleItem[] | null;
  brief: NoticeBriefAnswer | null;
}
