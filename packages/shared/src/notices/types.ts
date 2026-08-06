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

// ── Server-driven tab config (GET /notices/tabs) ──

/**
 * Reason a department is intentionally unsupported.
 *
 * Since the server resolves the localized copy itself (`excludeReasonText`,
 * sourced from the crawler's exclude-reasons.json SSOT), this union only
 * enumerates keys whose copy is ALSO bundled in the app i18n
 * (`onboarding.unsupportedDept.reason.<key>`) as an old-server fallback.
 * New keys need no app release — the server ships their copy.
 */
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
  /** Parent 단과대학 (e.g. "소프트웨어융합대학"). `null` for umbrella entries. */
  college: string | null;
  /**
   * Whether this source actually delivers notices in the app. `false` =
   * intentionally unsupported (see `excludeReason`); `true` = crawled, even
   * if cron is currently paused on the server side.
   */
  noticeAvailable: boolean;
  /**
   * When `noticeAvailable` is false, the reason key (crawler SSOT id).
   * `null` whenever `noticeAvailable` is true (biconditional invariant).
   * Not narrowed to `ExcludeReasonKey`: the server may introduce keys this
   * build doesn't know — display copy comes from `excludeReasonText`, with
   * bundled i18n only as a legacy fallback for the known keys.
   */
  excludeReason: string | null;
  /**
   * Localized reason copy resolved server-side (requested lang → en → ko).
   * `null` on older servers that pre-date the field.
   */
  excludeReasonText: string | null;
}

export interface PickerTabConfig {
  sources: TabSource[];
  maxSelection: number;
  /** Always seeded at onboarding regardless of campus. */
  defaultIds: string[];
  /** Campus-conditional: seeded only if user's campus matches the key. */
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
