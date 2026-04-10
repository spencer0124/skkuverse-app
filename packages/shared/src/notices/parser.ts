/**
 * Notice parsers — department list, paginated notice list, notice detail.
 *
 * Server source: skkuverse-server/features/notices/ (transform.js)
 */

import type { ApiEnvelope } from '../api/types';
import { CRAWLER_ENABLED_DEPT_IDS } from './constants';
import type {
  Department,
  NoticeDetail,
  NoticeDetailSummary,
  NoticeListItem,
  NoticeListItemSummary,
  NoticePage,
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

function parseDepartment(raw: Record<string, unknown>): Department {
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    campus: asNullableString(raw.campus),
    category: asNullableString(raw.category),
    hasCategory: asBool(raw.hasCategory),
    hasAuthor: asBool(raw.hasAuthor),
  };
}

function parseListItemSummary(raw: unknown): NoticeListItemSummary | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  return {
    oneLiner: asNullableString(obj.oneLiner),
    type: coerceSummaryType(obj.type),
    endDate: asNullableString(obj.endDate),
    endTime: asNullableString(obj.endTime),
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
    location: asNullableString(obj.location),
    host: asNullableString(obj.host),
    impact: asNullableString(obj.impact),
  };
}

function parseDetailSummary(raw: unknown): NoticeDetailSummary | null {
  if (raw === null || raw === undefined) return null;
  const obj = asRecord(raw);
  return {
    text: asNullableString(obj.text),
    oneLiner: asNullableString(obj.oneLiner),
    type: coerceSummaryType(obj.type),
    startDate: asNullableString(obj.startDate),
    startTime: asNullableString(obj.startTime),
    endDate: asNullableString(obj.endDate),
    endTime: asNullableString(obj.endTime),
    details: parseSummaryDetails(obj.details),
    model: asNullableString(obj.model),
    generatedAt: asString(obj.generatedAt),
  };
}

// ── Public parsers ──

/**
 * Parses GET /notices/departments response, filtering to the crawler-enabled
 * whitelist and preserving whitelist order (not server order).
 */
export function parseDepartmentList(envelope: ApiEnvelope<unknown>): Department[] {
  const data = asRecord(envelope.data);
  const rawList = Array.isArray(data.departments) ? (data.departments as unknown[]) : [];

  const byId = new Map<string, Department>();
  for (const item of rawList) {
    const dept = parseDepartment(asRecord(item));
    if (dept.id) byId.set(dept.id, dept);
  }

  const ordered: Department[] = [];
  for (const id of CRAWLER_ENABLED_DEPT_IDS) {
    const dept = byId.get(id);
    if (dept) ordered.push(dept);
  }
  return ordered;
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
    contentHtml: asNullableString(data.contentHtml),
    contentText: asNullableString(data.contentText),
    attachments: attachments.map(parseAttachment),
    sourceUrl: asString(data.sourceUrl),
    lastModified: asNullableString(data.lastModified),
    crawledAt: asString(data.crawledAt),
    editInfo: parseEditInfo(data.editInfo),
    summary: parseDetailSummary(data.summary),
  };
}
