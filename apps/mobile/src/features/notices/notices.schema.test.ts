// The hand parsers' suite, moved onto the zod schemas with every input and
// expected value unchanged.
import { describe, it, expect } from 'vitest';
import { parseOrThrow, type ApiEnvelope } from '@skkuverse/shared';
import { noticeDetailSchema, noticePageSchema, noticeTabsSchema } from './notices.schema';

const parseTabsConfig = (envelope: ApiEnvelope<unknown>) =>
  parseOrThrow(noticeTabsSchema, envelope.data, 'notices.tabs');
const parseNoticePage = (envelope: ApiEnvelope<unknown>) =>
  parseOrThrow(noticePageSchema, envelope.data, 'notices.page');
const parseNoticeDetail = (envelope: ApiEnvelope<unknown>) =>
  parseOrThrow(noticeDetailSchema, envelope.data, 'notices.detail');

function envelope<T>(data: T): ApiEnvelope<unknown> {
  return { meta: { ok: true }, data } as unknown as ApiEnvelope<unknown>;
}

describe('parseTabsConfig', () => {
  it('parses fixed and picker tabs in server order', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'dept',
          label: '학과',
          tabMode: 'picker',
          picker: {
            sources: [
              { id: 'arch', name: '건축학과', campus: 'nsc' },
              { id: 'biz', name: '경영학과', campus: 'hssc' },
            ],
            maxSelection: 5,
            defaultIds: [],
            campusDefaultIds: {},
          },
        },
        {
          key: 'academic',
          label: '학사',
          tabMode: 'fixed',
          fixed: { sourceId: 'skku-notice02', name: '성균관대_통합(학사)', campus: 'both' },
        },
      ],
    });

    const result = parseTabsConfig(raw);
    expect(result.schemaVersion).toBe(1);
    expect(result.tabs).toHaveLength(2);

    const [picker, fixed] = result.tabs;
    expect(picker.key).toBe('dept');
    expect(picker.tabMode).toBe('picker');
    expect(picker.picker?.sources).toHaveLength(2);
    expect(picker.picker?.maxSelection).toBe(5);
    expect(picker.picker?.defaultIds).toEqual([]);
    expect(picker.picker?.campusDefaultIds).toEqual({ hssc: [], nsc: [] });

    expect(fixed.key).toBe('academic');
    expect(fixed.tabMode).toBe('fixed');
    expect(fixed.fixed?.sourceId).toBe('skku-notice02');
  });

  it('skips tabs with unknown tabMode (forward compat)', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        { key: 'academic', label: '학사', tabMode: 'fixed', fixed: { sourceId: 'x', name: 'X', campus: 'both' } },
        { key: 'future', label: 'Future', tabMode: 'some-new-mode' },
        { key: 'dept', label: '학과', tabMode: 'picker', picker: { sources: [], maxSelection: 3, defaultIds: [], campusDefaultIds: {} } },
      ],
    });

    const result = parseTabsConfig(raw);
    expect(result.tabs).toHaveLength(2);
    expect(result.tabs.map((t) => t.key)).toEqual(['academic', 'dept']);
  });

  it('returns empty tabs when data missing', () => {
    const result = parseTabsConfig(envelope({}));
    expect(result.tabs).toEqual([]);
    expect(result.schemaVersion).toBe(1);
  });

  it('skips tabs with empty key', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        { key: '', label: 'No Key', tabMode: 'fixed', fixed: { sourceId: 'x', name: 'X', campus: 'both' } },
        { key: 'valid', label: 'Valid', tabMode: 'fixed', fixed: { sourceId: 'y', name: 'Y', campus: 'nsc' } },
      ],
    });
    const result = parseTabsConfig(raw);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].key).toBe('valid');
  });

  it('parses defaultIds + campusDefaultIds and filters ghost ids by sources list', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'library',
          label: '도서관',
          tabMode: 'picker',
          picker: {
            sources: [
              { id: 'lib-hssc', name: '중앙학술정보관', campus: 'hssc' },
              { id: 'lib-nsc', name: '삼성학술정보관', campus: 'nsc' },
              { id: 'lib-all', name: '학술정보관 본부', campus: 'both' },
            ],
            maxSelection: 3,
            defaultIds: ['lib-all', 'ghost-id'],
            campusDefaultIds: {
              hssc: ['lib-hssc', 'another-ghost'],
              nsc: ['lib-nsc'],
            },
          },
        },
      ],
    });
    const picker = parseTabsConfig(raw).tabs[0].picker;
    expect(picker?.defaultIds).toEqual(['lib-all']);
    expect(picker?.campusDefaultIds).toEqual({
      hssc: ['lib-hssc'],
      nsc: ['lib-nsc'],
    });
  });

  it('normalizes missing campusDefaultIds to empty hssc/nsc arrays', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'library',
          label: '도서관',
          tabMode: 'picker',
          picker: {
            sources: [{ id: 'lib-all', name: '본부', campus: null }],
            maxSelection: 3,
            defaultIds: ['lib-all'],
            // campusDefaultIds intentionally omitted
          },
        },
      ],
    });
    expect(parseTabsConfig(raw).tabs[0].picker?.campusDefaultIds).toEqual({
      hssc: [],
      nsc: [],
    });
  });

  it('drops unknown campus keys in campusDefaultIds', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'dorm',
          label: '기숙사',
          tabMode: 'picker',
          picker: {
            sources: [
              { id: 'dorm-hssc', name: '명륜학사', campus: 'hssc' },
              { id: 'dorm-nsc', name: '봉룡학사', campus: 'nsc' },
            ],
            maxSelection: 2,
            defaultIds: [],
            campusDefaultIds: {
              hssc: ['dorm-hssc'],
              future_campus: ['dorm-hssc'],
            },
          },
        },
      ],
    });
    expect(parseTabsConfig(raw).tabs[0].picker?.campusDefaultIds).toEqual({
      hssc: ['dorm-hssc'],
      nsc: [],
    });
  });

  // ── New TabSource fields (college / noticeAvailable / excludeReason) ──

  it('parses college, noticeAvailable, excludeReason on picker sources', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'dept',
          label: '학과',
          tabMode: 'picker',
          picker: {
            sources: [
              {
                id: 'cse-undergrad',
                name: '소프트웨어학과(학부생)',
                campus: 'nsc',
                college: '소프트웨어융합대학',
                noticeAvailable: true,
                excludeReason: null,
              },
              {
                id: 'med-undergrad',
                name: '의과대학(학부생)',
                campus: 'nsc',
                college: '의과대학',
                noticeAvailable: false,
                excludeReason: 'loginRequired',
              },
            ],
            maxSelection: 5,
            defaultIds: [],
            campusDefaultIds: {},
          },
        },
      ],
    });
    const sources = parseTabsConfig(raw).tabs[0].picker?.sources ?? [];
    expect(sources[0]).toMatchObject({
      college: '소프트웨어융합대학',
      noticeAvailable: true,
      excludeReason: null,
    });
    expect(sources[1]).toMatchObject({
      college: '의과대학',
      noticeAvailable: false,
      excludeReason: 'loginRequired',
    });
  });

  it('keeps unknown excludeReason keys (copy comes from excludeReasonText)', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'dept',
          label: '학과',
          tabMode: 'picker',
          picker: {
            sources: [
              {
                id: 'x',
                name: 'X',
                campus: 'nsc',
                college: null,
                noticeAvailable: false,
                excludeReason: 'futureNewReason',
                excludeReasonText: '새로운 사유 문구',
              },
            ],
            maxSelection: 1,
            defaultIds: [],
            campusDefaultIds: {},
          },
        },
      ],
    });
    const source = parseTabsConfig(raw).tabs[0].picker?.sources[0];
    expect(source?.excludeReason).toBe('futureNewReason');
    expect(source?.excludeReasonText).toBe('새로운 사유 문구');
  });

  it('excludeReasonText defaults to null on pre-SSOT server responses', () => {
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'dept',
          label: '학과',
          tabMode: 'picker',
          picker: {
            sources: [
              {
                id: 'x',
                name: 'X',
                campus: 'nsc',
                college: null,
                noticeAvailable: false,
                excludeReason: 'loginRequired',
              },
            ],
            maxSelection: 1,
            defaultIds: [],
            campusDefaultIds: {},
          },
        },
      ],
    });
    const source = parseTabsConfig(raw).tabs[0].picker?.sources[0];
    expect(source?.excludeReason).toBe('loginRequired');
    expect(source?.excludeReasonText).toBe(null);
  });

  it('defaults missing new fields safely (no crash, sensible values)', () => {
    // Server response that pre-dates the schema bump.
    const raw = envelope({
      schemaVersion: 1,
      tabs: [
        {
          key: 'dept',
          label: '학과',
          tabMode: 'picker',
          picker: {
            sources: [{ id: 'arch', name: '건축학과', campus: 'nsc' }],
            maxSelection: 5,
            defaultIds: [],
            campusDefaultIds: {},
          },
        },
      ],
    });
    const source = parseTabsConfig(raw).tabs[0].picker?.sources[0];
    expect(source).toMatchObject({
      college: null,
      noticeAvailable: true,
      excludeReason: null,
    });
  });
});

describe('parseNoticePage', () => {
  it('parses notices, nextCursor, hasMore', () => {
    const raw = envelope({
      notices: [
        {
          id: '66f0a1b2c3d4e5f6a7b8c9d0',
          sourceId: 'skku-main',
          articleNo: 12345,
          title: '2026학년도 1학기 수강신청 안내',
          category: '학사',
          author: '학사지원팀',
          department: '학사과',
          date: '2026-04-01',
          sourceUrl: 'https://www.skku.edu/notice/12345',
          hasContent: true,
          hasAttachments: true,
          isEdited: true,
        },
      ],
      nextCursor: 'eyJkIjoiMjAyNi0wNC0wMSJ9',
      hasMore: true,
    });

    const page = parseNoticePage(raw);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('eyJkIjoiMjAyNi0wNC0wMSJ9');
    expect(page.notices).toHaveLength(1);
    const n = page.notices[0];
    expect(n.id).toBe('66f0a1b2c3d4e5f6a7b8c9d0');
    expect(n.articleNo).toBe(12345);
    expect(n.title).toBe('2026학년도 1학기 수강신청 안내');
    expect(n.hasContent).toBe(true);
    expect(n.hasAttachments).toBe(true);
    expect(n.isEdited).toBe(true);
  });

  it('drops the summary and views the server sends', () => {
    const raw = envelope({
      notices: [
        {
          id: 'x',
          sourceId: 'skku-main',
          articleNo: 1,
          title: 't',
          category: null,
          author: null,
          department: null,
          date: '2026-04-01',
          views: 1200,
          sourceUrl: 'https://x',
          hasContent: true,
          hasAttachments: false,
          isEdited: false,
          summary: { oneLiner: 'o', type: 'action_required', endAt: { date: '2026-04-12', time: null } },
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    const [notice] = parseNoticePage(raw).notices;
    expect(notice).not.toHaveProperty('summary');
    expect(notice).not.toHaveProperty('views');
  });

  it('reads hasContent and isEdited as false when they are missing or not booleans', () => {
    const raw = envelope({
      notices: [
        {
          id: 'x',
          sourceId: 'skku-main',
          articleNo: 1,
          title: 't',
          category: null,
          author: null,
          department: null,
          date: '2026-04-01',
          sourceUrl: 'https://x',
          hasContent: null,
          hasAttachments: false,
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    const page = parseNoticePage(raw);
    expect(page.notices[0].hasContent).toBe(false);
    expect(page.notices[0].isEdited).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });

  it('handles empty notices array', () => {
    const raw = envelope({ notices: [], nextCursor: null, hasMore: false });
    const page = parseNoticePage(raw);
    expect(page.notices).toEqual([]);
  });
});

describe('parseNoticeDetail', () => {
  it('parses a full notice detail envelope', () => {
    const raw = envelope({
      id: 'abc',
      sourceId: 'skku-main',
      articleNo: 999,
      title: '중요 공지',
      category: '안내',
      author: '총무과',
      department: '학사과',
      date: '2026-04-05',
      contentMarkdown: '**본문**',
      attachments: [{ name: '첨부.pdf', url: 'https://x/1.pdf' }],
      sourceUrl: 'https://www.skku.edu/notice/999',
      lastModified: '2026-04-06T10:00:00Z',
      crawledAt: '2026-04-06T11:00:00Z',
      editInfo: { count: 1, history: [] },
    });

    const detail = parseNoticeDetail(raw);
    expect(detail.id).toBe('abc');
    expect(detail.articleNo).toBe(999);
    expect(detail.contentMarkdown).toBe('**본문**');
    expect(detail.attachments).toEqual([{ name: '첨부.pdf', url: 'https://x/1.pdf' }]);
    expect(detail.editInfo?.count).toBe(1);
  });

  it('keeps only the posting day when a board sends a time with it', () => {
    const raw = envelope({
      id: 'abc',
      sourceId: 'skku-main',
      articleNo: 1,
      title: 't',
      date: '2026-10-01 11:25',
      sourceUrl: 'https://x',
      crawledAt: '2026-10-01T02:25:00Z',
    });

    expect(parseNoticeDetail(raw).date).toBe('2026-10-01');
  });

  it('tolerates missing optional fields', () => {
    const raw = envelope({
      id: 'abc',
      sourceId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-01',
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-01T00:00:00Z',
      editInfo: null,
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.editInfo).toBeNull();
    expect(detail.attachments).toEqual([]);
    expect(detail.contentMarkdown).toBeNull();
  });

  it('drops the summary and views an older server still sends', () => {
    const raw = envelope({
      id: 'abc',
      sourceId: 'skku-main',
      articleNo: 1,
      title: 't',
      date: '2026-04-01',
      views: 500,
      summary: { text: '요약 본문', oneLiner: '한 줄', type: 'event', periods: [], locations: [] },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail).not.toHaveProperty('summary');
    expect(detail).not.toHaveProperty('views');
  });
});
