// CONTRACT(skkuverse-server): skkuverse-server/src/notices/ writes these shapes; only a field the screen
// cannot render without is required, and every other field keeps its default.
import { z } from 'zod';
import { openEnum, openUnionArray, text, tolerantArray } from '@skkuverse/shared';
import { listOrEmpty, noticeListRowSchema, nullOr } from './notice-facts.schema';
import type { NoticeAttachment, NoticeDetail, NoticeDetailSummary, NoticeEditInfo, NoticeEndAt, NoticeListItem, NoticeListItemSummary, NoticeLocation, NoticePage, NoticePeriod, NoticeStartAt, NoticeSummaryDetails, NoticeTab, NoticeTabsConfig, PickerTabConfig, TabSource } from './notices.types';

const str = (fallback = '') => z.string().catch(fallback);
const nullableStr = z.string().nullable().catch(null);
const num = (fallback: number) => z.number().catch(fallback);
const bool = (fallback: boolean) => z.boolean().catch(fallback);

const summaryType = openEnum(['action_required', 'event', 'informational'] as const, 'informational');

function anyObject<S extends z.ZodObject>(shape: S) {
  return shape.catch(() => shape.parse({}));
}

const startAtSchema = anyObject(z.object({ date: nullableStr, time: nullableStr })).transform(
  ({ date, time }): NoticeStartAt | null => (date === null && time === null ? null : { date, time }),
);

const endAtSchema = anyObject(z.object({ date: nullableStr, time: nullableStr, label: nullableStr })).transform(
  ({ date, time, label }): NoticeEndAt | null =>
    date === null && time === null && label === null ? null : { date, time, label },
);

const listItemSummarySchema = nullOr(
  anyObject(
    z.object({ oneLiner: nullableStr, type: summaryType, startAt: startAtSchema, endAt: endAtSchema }),
  ).transform((summary): NoticeListItemSummary => summary),
);

const listItemSchema = z
  .object({
    id: str(),
    sourceId: z.string(),
    articleNo: z.number(),
    title: z.string(),
    category: nullableStr,
    author: nullableStr,
    department: nullableStr,
    // WHY: some sources send "YYYY-MM-DD HH:MM"; the first ten characters are the contract's date.
    date: str().transform((date) => date.slice(0, 10)),
    views: num(0),
    sourceUrl: str(),
    contentHash: z.unknown().optional(),
    hasAttachments: bool(false),
    editCount: num(0),
    summary: listItemSummarySchema,
    row: noticeListRowSchema,
  })
  .transform(
    ({ contentHash, editCount, ...item }): NoticeListItem => ({
      ...item,
      // WHY: read from contentHash, though the server also sends hasContent; switching is a separate change.
      hasContent: contentHash !== null && contentHash !== undefined && contentHash !== '',
      isEdited: editCount > 0,
    }),
  );

function noticePageSchemaFor(where: string) {
  return z
    .object({
      notices: listOrEmpty.pipe(tolerantArray(listItemSchema, where)),
      nextCursor: nullableStr,
      hasMore: bool(false),
    })
    .transform((page): NoticePage => page);
}

export const noticePageSchema = noticePageSchemaFor('notices.page');

// WHY: the drop reporter keeps one breadcrumb per name per process, so a shared
// name would let a drop in one list hide every later drop in the other.
export const multiSourceNoticePageSchema = noticePageSchemaFor('notices.multiPage');

const attachmentSchema = anyObject(z.object({ name: str(), url: str() })).transform(
  (attachment): NoticeAttachment => attachment,
);

const editInfoSchema = nullOr(
  anyObject(z.object({ count: num(0), history: listOrEmpty })).transform((info): NoticeEditInfo => info),
);

const periodSchema = anyObject(
  z.object({
    label: nullableStr,
    startDate: nullableStr,
    startTime: nullableStr,
    endDate: nullableStr,
    endTime: nullableStr,
  }),
).transform((period): NoticePeriod => period);

const locationSchema = anyObject(z.object({ label: nullableStr, detail: str().transform((d) => d.trim()) }));

const summaryDetailsSchema = nullOr(
  anyObject(z.object({ target: nullableStr, action: nullableStr, host: nullableStr, impact: nullableStr })).transform(
    (details): NoticeSummaryDetails => details,
  ),
);

const detailSummarySchema = nullOr(
  anyObject(
    z.object({
      text: nullableStr,
      oneLiner: nullableStr,
      type: summaryType,
      periods: listOrEmpty.pipe(tolerantArray(periodSchema, 'notices.detail.periods')),
      // WHY: a location with a blank detail has nothing to show, so it is left out silently.
      locations: listOrEmpty
        .pipe(tolerantArray(locationSchema, 'notices.detail.locations'))
        .transform((locations): NoticeLocation[] => locations.filter((location) => location.detail !== '')),
      details: summaryDetailsSchema,
      model: nullableStr,
      generatedAt: str(),
    }),
  ).transform((summary): NoticeDetailSummary => summary),
);

export const noticeDetailSchema = z
  .object({
    id: str(),
    sourceId: z.string(),
    articleNo: z.number(),
    title: str(),
    category: nullableStr,
    author: nullableStr,
    department: nullableStr,
    date: str(),
    views: num(0),
    contentMarkdown: nullableStr,
    attachments: listOrEmpty.pipe(tolerantArray(attachmentSchema, 'notices.detail.attachments')),
    sourceUrl: str(),
    lastModified: nullableStr,
    crawledAt: str(),
    editInfo: editInfoSchema,
    summary: detailSummarySchema,
  })
  .transform((detail): NoticeDetail => detail);

const tabSourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    campus: nullableStr,
    college: nullableStr,
    // WHY: true when absent, so a server from before the field renders no dept as unsupported.
    noticeAvailable: bool(true),
    // WHY: any non-empty key; display copy is the server's excludeReasonText (hasBundledExcludeReasonCopy).
    excludeReason: z.string().min(1).nullable().catch(null),
    excludeReasonText: nullableStr,
  })
  .transform((source): TabSource => source);

const campusDefaultIdsSchema = anyObject(z.object({ hssc: listOrEmpty, nsc: listOrEmpty }));

const pickerConfigSchema = anyObject(
  z.object({
    sources: listOrEmpty.pipe(tolerantArray(tabSourceSchema, 'notices.tabs.sources')),
    maxSelection: num(5),
    defaultIds: listOrEmpty,
    campusDefaultIds: campusDefaultIdsSchema,
  }),
).transform(({ sources, maxSelection, defaultIds, campusDefaultIds }): PickerTabConfig => {
  // WHY: ids are kept only when the picker lists them, so a stale config cannot seed a ghost id.
  const validIds = new Set(sources.map((source) => source.id));
  const known = (ids: unknown[]): string[] =>
    ids.filter((id): id is string => typeof id === 'string' && validIds.has(id));
  return {
    sources,
    maxSelection,
    defaultIds: known(defaultIds),
    campusDefaultIds: { hssc: known(campusDefaultIds.hssc), nsc: known(campusDefaultIds.nsc) },
  };
});

const fixedConfigSchema = anyObject(z.object({ sourceId: str(), name: str(), campus: str('both') }));

/** WHY: a tab of a mode this build does not know is left out. */
export const noticeTabsSchema = z
  .object({
    schemaVersion: num(1),
    tabs: listOrEmpty.pipe(
      openUnionArray(
        'tabMode',
        {
          picker: z
            .object({ key: text, label: str(), picker: pickerConfigSchema })
            .transform(({ key, label, picker }): NoticeTab => ({ key, label, tabMode: 'picker', picker })),
          fixed: z
            .object({ key: text, label: str(), fixed: fixedConfigSchema })
            .transform(({ key, label, fixed }): NoticeTab => ({ key, label, tabMode: 'fixed', fixed })),
        },
        'notices.tabs',
      ),
    ),
  })
  .transform((config): NoticeTabsConfig => config);
