/**
 * Notice parsers — department list, paginated notice list, notice detail.
 *
 * Server source: skkuverse-server/features/notices/ (transform.js)
 */

import type { ApiEnvelope } from '../api/types';
import type {
  NoticeDetail,
  NoticeDetailSummary,
  NoticeEndAt,
  NoticeListItem,
  NoticeListItemSummary,
  NoticeLocation,
  NoticePage,
  NoticePeriod,
  NoticeStartAt,
  NoticeTab,
  NoticeTabsConfig,
  NoticeSummaryType,
  NoticeSummaryDetails,
  NoticeAttachment,
  NoticeEditInfo,
} from './types';

// ── Internal helpers ──

function asRecord(raw: unknown): Record<string, unknown> {
  return (raw ?? {}) as Record<string, unknown>;
}

function asString(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function asNullableString(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

function asNumber(raw: unknown, fallback = 0): number {
  return typeof raw === 'number' ? raw : fallback;
}

function asBool(raw: unknown, fallback = false): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

const VALID_SUMMARY_TYPES: ReadonlySet<NoticeSummaryType> = new Set([
  'action_required',
  'event',
  'informational',
]);

function coerceSummaryType(raw: unknown): NoticeSummaryType {
  return typeof raw === 'string' && VALID_SUMMARY_TYPES.has(raw as NoticeSummaryType)
    ? (raw as NoticeSummaryType)
    : 'informational';
}

function parseStartAt(raw: unknown): NoticeStartAt | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  const date = asNullableString(obj.date);
  const time = asNullableString(obj.time);
  if (date === null && time === null) return null;
  return { date, time };
}

function parseEndAt(raw: unknown): NoticeEndAt | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  const date = asNullableString(obj.date);
  const time = asNullableString(obj.time);
  const label = asNullableString(obj.label);
  if (date === null && time === null && label === null) return null;
  return { date, time, label };
}

function parseListItemSummary(raw: unknown): NoticeListItemSummary | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  return {
    oneLiner: asNullableString(obj.oneLiner),
    type: coerceSummaryType(obj.type),
    startAt: parseStartAt(obj.startAt),
    endAt: parseEndAt(obj.endAt),
  };
}

function parseNoticeListItem(raw: Record<string, unknown>): NoticeListItem {
  const contentHash = raw.contentHash;
  const editCount = asNumber(raw.editCount, 0);
  return {
    id: asString(raw.id),
    deptId: asString(raw.deptId),
    articleNo: asNumber(raw.articleNo),
    title: asString(raw.title),
    category: asNullableString(raw.category),
    author: asNullableString(raw.author),
    department: asNullableString(raw.department),
    date: asString(raw.date),
    views: asNumber(raw.views, 0),
    sourceUrl: asString(raw.sourceUrl),
    hasContent: contentHash !== null && contentHash !== undefined && contentHash !== '',
    hasAttachments: asBool(raw.hasAttachments, false),
    isEdited: editCount > 0,
    summary: parseListItemSummary(raw.summary),
  };
}

function parseAttachment(raw: unknown): NoticeAttachment {
  const obj = asRecord(raw);
  return {
    name: asString(obj.name),
    url: asString(obj.url),
  };
}

function parseEditInfo(raw: unknown): NoticeEditInfo | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  return {
    count: asNumber(obj.count, 0),
    history: Array.isArray(obj.history) ? (obj.history as unknown[]) : [],
  };
}

function parseSummaryDetails(raw: unknown): NoticeSummaryDetails | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  // Pick only the known keys — drop forward-compat unknowns so the typed
  // shape stays exact.
  return {
    target: asNullableString(obj.target),
    action: asNullableString(obj.action),
    host: asNullableString(obj.host),
    impact: asNullableString(obj.impact),
  };
}

function parsePeriod(raw: unknown): NoticePeriod {
  const obj = asRecord(raw);
  return {
    label: asNullableString(obj.label),
    startDate: asNullableString(obj.startDate),
    startTime: asNullableString(obj.startTime),
    endDate: asNullableString(obj.endDate),
    endTime: asNullableString(obj.endTime),
  };
}

function parsePeriods(raw: unknown): NoticePeriod[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map(parsePeriod);
}

function parseLocation(raw: unknown): NoticeLocation | null {
  const obj = asRecord(raw);
  const detail = asString(obj.detail).trim();
  if (!detail) return null;
  return {
    label: asNullableString(obj.label),
    detail,
  };
}

function parseLocations(raw: unknown): NoticeLocation[] {
  if (!Array.isArray(raw)) return [];
  const out: NoticeLocation[] = [];
  for (const item of raw as unknown[]) {
    const loc = parseLocation(item);
    if (loc) out.push(loc);
  }
  return out;
}

function parseDetailSummary(raw: unknown): NoticeDetailSummary | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  return {
    text: asNullableString(obj.text),
    oneLiner: asNullableString(obj.oneLiner),
    type: coerceSummaryType(obj.type),
    periods: parsePeriods(obj.periods),
    locations: parseLocations(obj.locations),
    details: parseSummaryDetails(obj.details),
    model: asNullableString(obj.model),
    generatedAt: asString(obj.generatedAt),
  };
}

// ── Public parsers ──

/**
 * Parses GET /notices/tabs response.
 *
 * Unknown `tabMode` values are silently skipped for forward compatibility.
 * If `schemaVersion` exceeds 1 (current supported version), parsing is still
 * attempted best-effort — the caller handles the "0 valid tabs" case as error.
 */
export function parseTabsConfig(envelope: ApiEnvelope<unknown>): NoticeTabsConfig {
  const data = asRecord(envelope.data);
  const schemaVersion = asNumber(data.schemaVersion, 1);
  const rawTabs = Array.isArray(data.tabs) ? (data.tabs as unknown[]) : [];

  const tabs: NoticeTab[] = [];
  for (const raw of rawTabs) {
    const obj = asRecord(raw);
    const tabMode = asString(obj.tabMode);
    if (tabMode !== 'picker' && tabMode !== 'fixed') continue;

    const tab: NoticeTab = {
      key: asString(obj.key),
      label: asString(obj.label),
      tabMode,
    };

    if (tabMode === 'picker') {
      const p = asRecord(obj.picker);
      const rawDepts = Array.isArray(p.departments) ? (p.departments as unknown[]) : [];
      tab.picker = {
        departments: rawDepts.map((d) => {
          const dd = asRecord(d);
          return {
            id: asString(dd.id),
            name: asString(dd.name),
            campus: asNullableString(dd.campus),
          };
        }),
        maxSelection: asNumber(p.maxSelection, 5),
        defaultDeptIds: Array.isArray(p.defaultDeptIds)
          ? (p.defaultDeptIds as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
      };
    }

    if (tabMode === 'fixed') {
      const f = asRecord(obj.fixed);
      tab.fixed = {
        deptId: asString(f.deptId),
        name: asString(f.name),
        campus: asString(f.campus, 'both'),
      };
    }

    if (tab.key) tabs.push(tab);
  }

  return { schemaVersion, tabs };
}

/**
 * Parses GET /notices/dept/:deptId response.
 */
export function parseNoticePage(envelope: ApiEnvelope<unknown>): NoticePage {
  const data = asRecord(envelope.data);
  const rawNotices = Array.isArray(data.notices) ? (data.notices as unknown[]) : [];
  return {
    notices: rawNotices.map((n) => parseNoticeListItem(asRecord(n))),
    nextCursor: asNullableString(data.nextCursor),
    hasMore: asBool(data.hasMore, false),
  };
}

/**
 * Parses GET /notices/:deptId/:articleNo response.
 */
export function parseNoticeDetail(envelope: ApiEnvelope<unknown>): NoticeDetail {
  const data = asRecord(envelope.data);
  const attachments = Array.isArray(data.attachments) ? (data.attachments as unknown[]) : [];
  return {
    id: asString(data.id),
    deptId: asString(data.deptId),
    articleNo: asNumber(data.articleNo),
    title: asString(data.title),
    category: asNullableString(data.category),
    author: asNullableString(data.author),
    department: asNullableString(data.department),
    date: asString(data.date),
    views: asNumber(data.views, 0),
    contentMarkdown: asNullableString(data.contentMarkdown),
    attachments: attachments.map(parseAttachment),
    sourceUrl: asString(data.sourceUrl),
    lastModified: asNullableString(data.lastModified),
    crawledAt: asString(data.crawledAt),
    editInfo: parseEditInfo(data.editInfo),
    summary: parseDetailSummary(data.summary),
  };
}
