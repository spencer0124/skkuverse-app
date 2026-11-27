// CONTRACT(skkuverse-server): skkuverse-server/src/notices/ writes these shapes; only a field the screen
// cannot render without is required, and every other field keeps its default.
import { z } from 'zod';
import { openUnionArray, parsedBy, text, tolerantArray } from '@skkuverse/shared';
import { noticeBriefSchema } from './notice-brief.schema';
import { noticeScheduleSchema } from './notice-schedule.schema';
import type { NoticeAttachment, NoticeDetail, NoticeEditInfo, NoticeListItem, NoticePage, NoticeTab, NoticeTabsConfig, PickerTabConfig, TabSource } from './notices.types';

const str = (fallback = '') => z.string().catch(fallback);
const nullableStr = z.string().nullable().catch(null);
const num = (fallback: number) => z.number().catch(fallback);
const bool = (fallback: boolean) => z.boolean().catch(fallback);

// WHY: a missing or non-list field reads as an empty list.
const listOrEmpty = parsedBy((raw) => (Array.isArray(raw) ? raw : []));

function nullOr<S extends z.ZodType>(objectSchema: S) {
  return z.union([z.null(), z.undefined()]).transform(() => null).or(objectSchema);
}

function anyObject<S extends z.ZodObject>(shape: S) {
  return shape.catch(() => shape.parse({}));
}

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
    sourceUrl: str(),
    contentHash: z.unknown().optional(),
    hasAttachments: bool(false),
    editCount: num(0),
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
    contentMarkdown: nullableStr,
    attachments: listOrEmpty.pipe(tolerantArray(attachmentSchema, 'notices.detail.attachments')),
    sourceUrl: str(),
    lastModified: nullableStr,
    crawledAt: str(),
    editInfo: editInfoSchema,
    schedule: noticeScheduleSchema,
    brief: noticeBriefSchema,
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
