/**
 * Notice parsers — department list, paginated notice list, notice detail.
 *
 * Server source: skkuverse-server/features/notices/ (transform.js)
 */

import type { ApiEnvelope } from '../api/types';
import type {
  ExcludeReasonKey,
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

const KNOWN_EXCLUDE_REASONS: ReadonlySet<ExcludeReasonKey> = new Set<ExcludeReasonKey>([
  'loginRequired',
  'noWebsite',
  'externalSystem',
  'accessRestricted',
  'temporarilyUnavailable',
]);

function asExcludeReason(raw: unknown): ExcludeReasonKey | null {
  // Forward-compat: unknown enum values from a newer server are downgraded to
  // null rather than rejected, so an enum addition can be deployed
  // server-first without breaking existing clients.
  return typeof raw === 'string' && KNOWN_EXCLUDE_REASONS.has(raw as ExcludeReasonKey)
    ? (raw as ExcludeReasonKey)
    : null;
}

// ── Internal helpers ──

function asRecord(raw: unknown): Record<string, unknown> {
  return (raw ?? {}) as Record<string, unknown>;
}

/**
 * Server-side `date` field is contractually "YYYY-MM-DD" (per NoticeListItem
 * docs + formatRelativeDate / groupNoticesByDate consumers), but some sources
 * (e.g. ecostat-undergrad) emit "YYYY-MM-DD HH:MM" and ISO timestamps could
 * appear in the future. Truncate to the first 10 chars so downstream split('-')
 * always sees `[YYYY, MM, DD]` and items don't fall into the "기타" bucket.
 */
function normalizeNoticeDate(raw: string): string {
  return raw.slice(0, 10);
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
    sourceId: asString(raw.sourceId),
    articleNo: asNumber(raw.articleNo),
    title: asString(raw.title),
    category: asNullableString(raw.category),
    author: asNullableString(raw.author),
    department: asNullableString(raw.department),
    date: normalizeNoticeDate(asString(raw.date)),
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
      const rawSources = Array.isArray(p.sources) ? (p.sources as unknown[]) : [];
      const sources = rawSources.map((s) => {
        const ss = asRecord(s);
        return {
          id: asString(ss.id),
          name: asString(ss.name),
          campus: asNullableString(ss.campus),
          college: asNullableString(ss.college),
          // Default `true` so a server response that pre-dates the field
          // doesn't render every dept as unsupported.
          noticeAvailable: asBool(ss.noticeAvailable, true),
          excludeReason: asExcludeReason(ss.excludeReason),
        };
      });
      const validIds = new Set(sources.map((s) => s.id));

      const defaultIds = Array.isArray(p.defaultIds)
        ? (p.defaultIds as unknown[]).filter(
            (x): x is string => typeof x === 'string' && validIds.has(x),
          )
        : [];

      // campusDefaultIds: object with optional 'hssc' / 'nsc' arrays. Unknown
      // keys are dropped, non-array values become []; ids are filtered against
      // the picker's known source list so a stale config can't seed a ghost id.
      const rawCampus = asRecord(p.campusDefaultIds);
      const parseCampusList = (raw: unknown): string[] =>
        Array.isArray(raw)
          ? (raw as unknown[]).filter(
              (x): x is string => typeof x === 'string' && validIds.has(x),
            )
          : [];

      tab.picker = {
        sources,
        maxSelection: asNumber(p.maxSelection, 5),
        defaultIds,
        campusDefaultIds: {
          hssc: parseCampusList(rawCampus.hssc),
          nsc: parseCampusList(rawCampus.nsc),
        },
      };
    }

    if (tabMode === 'fixed') {
      const f = asRecord(obj.fixed);
      tab.fixed = {
        sourceId: asString(f.sourceId),
        name: asString(f.name),
        campus: asString(f.campus, 'both'),
      };
    }

    if (tab.key) tabs.push(tab);
  }

  return { schemaVersion, tabs };
}

/**
 * Parses GET /notices/source/:sourceId response.
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
 * Parses GET /notices/:sourceId/:articleNo response.
 */
export function parseNoticeDetail(envelope: ApiEnvelope<unknown>): NoticeDetail {
  const data = asRecord(envelope.data);
  const attachments = Array.isArray(data.attachments) ? (data.attachments as unknown[]) : [];
  return {
    id: asString(data.id),
    sourceId: asString(data.sourceId),
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
