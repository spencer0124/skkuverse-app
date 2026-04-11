import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import {
  parseDepartmentList,
  parseNoticePage,
  parseNoticeDetail,
} from '../parser';

function envelope<T>(data: T): ApiEnvelope<unknown> {
  return { meta: { ok: true }, data } as unknown as ApiEnvelope<unknown>;
}

describe('parseDepartmentList', () => {
  it('filters to crawler-enabled whitelist and preserves whitelist order', () => {
    // Server returns all 144 — we give it a mixed sample, out-of-order.
    const raw = envelope({
      version: '2026-04-10',
      departments: [
        { id: 'biz-undergrad', name: '경영대학(학부생)', campus: 'hssc', category: null, hasCategory: false, hasAuthor: false },
        { id: 'medicine', name: '의과대학', campus: 'nsc', category: null, hasCategory: true, hasAuthor: true },
        { id: 'skku-main', name: '학부통합(학사)', campus: null, category: null, hasCategory: false, hasAuthor: false },
        { id: 'cheme', name: '화학공학과', campus: 'nsc', category: null, hasCategory: true, hasAuthor: false },
        { id: 'unknown-dept', name: 'Nope', campus: null, category: null, hasCategory: false, hasAuthor: false },
        { id: 'nano', name: '나노공학과', campus: 'nsc', category: null, hasCategory: true, hasAuthor: true },
        { id: 'cal-undergrad', name: '문과대학(학부)', campus: 'hssc', category: null, hasCategory: false, hasAuthor: false },
        { id: 'dorm-seoul', name: '명륜학사', campus: 'hssc', category: null, hasCategory: false, hasAuthor: false },
        { id: 'bio-undergrad', name: '생명공학대학(학부)', campus: 'nsc', category: null, hasCategory: true, hasAuthor: true },
      ],
    });

    const result = parseDepartmentList(raw);
    const ids = result.map((d) => d.id);

    expect(ids).toEqual([
      'skku-main',
      'cal-undergrad',
      'bio-undergrad',
      'nano',
      'dorm-seoul',
      'medicine',
      'cheme',
    ]);
  });

  it('skips a whitelisted id if server omits it (crawler/server out of sync)', () => {
    const raw = envelope({
      departments: [
        { id: 'skku-main', name: '학부통합(학사)', campus: null, category: null, hasCategory: false, hasAuthor: false },
        { id: 'medicine', name: '의과대학', campus: 'nsc', category: null, hasCategory: true, hasAuthor: true },
      ],
    });
    const result = parseDepartmentList(raw);
    expect(result.map((d) => d.id)).toEqual(['skku-main', 'medicine']);
  });

  it('returns empty array when data missing', () => {
    expect(parseDepartmentList(envelope({}))).toEqual([]);
  });

  it('maps all Department fields with sensible defaults', () => {
    const raw = envelope({
      departments: [
        {
          id: 'skku-main',
          name: '학부통합(학사)',
          campus: 'hssc',
          category: '학사',
          hasCategory: true,
          hasAuthor: false,
        },
      ],
    });
    const [dept] = parseDepartmentList(raw);
    expect(dept).toEqual({
      id: 'skku-main',
      name: '학부통합(학사)',
      campus: 'hssc',
      category: '학사',
      hasCategory: true,
      hasAuthor: false,
    });
  });
});

describe('parseNoticePage', () => {
  it('parses notices, nextCursor, hasMore', () => {
    const raw = envelope({
      notices: [
        {
          id: '66f0a1b2c3d4e5f6a7b8c9d0',
          deptId: 'skku-main',
          articleNo: 12345,
          title: '2026학년도 1학기 수강신청 안내',
          category: '학사',
          author: '학사지원팀',
          department: '학사과',
          date: '2026-04-01',
          views: 1200,
          sourceUrl: 'https://www.skku.edu/notice/12345',
          contentHash: 'abc',
          hasAttachments: true,
          editCount: 2,
          summary: {
            oneLiner: '수강신청은 4월 5일부터',
            type: 'action_required',
            startAt: { date: '2026-04-05', time: null },
            endAt: { date: '2026-04-12', time: '23:59', label: '1차 신청' },
          },
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
    expect(n.hasContent).toBe(true); // contentHash present
    expect(n.hasAttachments).toBe(true);
    expect(n.isEdited).toBe(true); // editCount > 0
    expect(n.summary?.type).toBe('action_required');
    expect(n.summary?.oneLiner).toBe('수강신청은 4월 5일부터');
    expect(n.summary?.startAt).toEqual({ date: '2026-04-05', time: null });
    expect(n.summary?.endAt).toEqual({
      date: '2026-04-12',
      time: '23:59',
      label: '1차 신청',
    });
  });

  it('normalizes endAt to null when date, time, and label are all null', () => {
    const raw = envelope({
      notices: [
        {
          id: 'x',
          deptId: 'skku-main',
          articleNo: 1,
          title: 't',
          category: null,
          author: null,
          department: null,
          date: '2026-04-01',
          views: 0,
          sourceUrl: 'https://x',
          contentHash: 'h',
          hasAttachments: false,
          editCount: 0,
          summary: {
            oneLiner: 'o',
            type: 'informational',
            endAt: { date: null, time: null },
          },
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    expect(parseNoticePage(raw).notices[0].summary?.endAt).toBeNull();
  });

  it('accepts endAt: null from server', () => {
    const raw = envelope({
      notices: [
        {
          id: 'x',
          deptId: 'skku-main',
          articleNo: 1,
          title: 't',
          category: null,
          author: null,
          department: null,
          date: '2026-04-01',
          views: 0,
          sourceUrl: 'https://x',
          contentHash: 'h',
          hasAttachments: false,
          editCount: 0,
          summary: {
            oneLiner: 'o',
            type: 'informational',
            endAt: null,
          },
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    expect(parseNoticePage(raw).notices[0].summary?.endAt).toBeNull();
  });

  it('derives hasContent=false when contentHash is null/missing', () => {
    const raw = envelope({
      notices: [
        {
          id: 'x',
          deptId: 'skku-main',
          articleNo: 1,
          title: 't',
          category: null,
          author: null,
          department: null,
          date: '2026-04-01',
          views: 0,
          sourceUrl: 'https://x',
          contentHash: null,
          hasAttachments: false,
          editCount: 0,
          summary: null,
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    const page = parseNoticePage(raw);
    expect(page.notices[0].hasContent).toBe(false);
    expect(page.notices[0].isEdited).toBe(false);
    expect(page.notices[0].summary).toBeNull();
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });

  it('handles empty notices array', () => {
    const raw = envelope({ notices: [], nextCursor: null, hasMore: false });
    const page = parseNoticePage(raw);
    expect(page.notices).toEqual([]);
  });

  it('coerces unknown summary type to informational', () => {
    const raw = envelope({
      notices: [
        {
          id: 'x',
          deptId: 'skku-main',
          articleNo: 1,
          title: 't',
          category: null,
          author: null,
          department: null,
          date: '2026-04-01',
          views: 0,
          sourceUrl: 'https://x',
          contentHash: 'h',
          hasAttachments: false,
          editCount: 0,
          summary: { oneLiner: null, type: 'weird-type', endAt: null },
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    const page = parseNoticePage(raw);
    expect(page.notices[0].summary?.type).toBe('informational');
  });
});

describe('parseNoticeDetail', () => {
  it('parses a full notice detail envelope', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 999,
      title: '중요 공지',
      category: '안내',
      author: '총무과',
      department: '학사과',
      date: '2026-04-05',
      views: 500,
      contentMarkdown: '**본문**',
      attachments: [{ name: '첨부.pdf', url: 'https://x/1.pdf' }],
      sourceUrl: 'https://www.skku.edu/notice/999',
      lastModified: '2026-04-06T10:00:00Z',
      crawledAt: '2026-04-06T11:00:00Z',
      editInfo: { count: 1, history: [] },
      summary: {
        text: '요약 본문',
        oneLiner: '한 줄',
        type: 'event',
        periods: [
          {
            label: null,
            startDate: '2026-05-01',
            startTime: '10:00',
            endDate: '2026-05-02',
            endTime: '18:00',
          },
        ],
        locations: [],
        details: null,
        model: 'gpt-4',
        generatedAt: '2026-04-06T11:30:00Z',
      },
    });

    const detail = parseNoticeDetail(raw);
    expect(detail.id).toBe('abc');
    expect(detail.articleNo).toBe(999);
    expect(detail.contentMarkdown).toBe('**본문**');
    expect(detail.attachments).toEqual([{ name: '첨부.pdf', url: 'https://x/1.pdf' }]);
    expect(detail.summary?.type).toBe('event');
    expect(detail.summary?.periods).toHaveLength(1);
    expect(detail.summary?.periods[0].startDate).toBe('2026-05-01');
    expect(detail.summary?.locations).toEqual([]);
    expect(detail.editInfo?.count).toBe(1);
  });

  it('tolerates null summary and missing optional fields', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-01',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-01T00:00:00Z',
      editInfo: null,
      summary: null,
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary).toBeNull();
    expect(detail.editInfo).toBeNull();
    expect(detail.attachments).toEqual([]);
    expect(detail.contentMarkdown).toBeNull();
  });

  it('parses single period + single location (Sample 1: Samsung 채용설명회)', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-09',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-09T00:00:00Z',
      editInfo: null,
      summary: {
        text: '삼성전자에서 이공계 재학생 대상 채용설명회를 진행해요.',
        oneLiner: '2026-04-15 14:00 삼성전자 채용설명회',
        type: 'event',
        periods: [
          {
            label: null,
            startDate: '2026-04-15',
            startTime: '14:00',
            endDate: '2026-04-15',
            endTime: null,
          },
        ],
        locations: [{ label: null, detail: '경영관 33101호' }],
        details: {
          target: '이공계 재학생',
          action: '사전 신청 필수 (캠퍼스 리크루팅 포털)',
          host: '삼성전자',
          impact: null,
        },
        model: 'gpt-4.1-mini',
        generatedAt: '2026-04-09T11:52:02.769Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.periods).toEqual([
      {
        label: null,
        startDate: '2026-04-15',
        startTime: '14:00',
        endDate: '2026-04-15',
        endTime: null,
      },
    ]);
    expect(detail.summary?.locations).toEqual([
      { label: null, detail: '경영관 33101호' },
    ]);
    expect(detail.summary?.details).toEqual({
      target: '이공계 재학생',
      action: '사전 신청 필수 (캠퍼스 리크루팅 포털)',
      host: '삼성전자',
      impact: null,
    });
  });

  it('parses multi-phase periods + multi-location (Sample 2: 등록금 납부)', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-02-01',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-02-01T00:00:00Z',
      editInfo: null,
      summary: {
        text: '등록금 1차 2/10~14, 2차 2/24~26 납부 안내',
        oneLiner: '등록금 1차 2/10~14, 2차 2/24~26 납부 안내',
        type: 'action_required',
        periods: [
          {
            label: '1차 납부',
            startDate: '2026-02-10',
            startTime: null,
            endDate: '2026-02-14',
            endTime: null,
          },
          {
            label: '2차 추가 납부',
            startDate: '2026-02-24',
            startTime: null,
            endDate: '2026-02-26',
            endTime: null,
          },
        ],
        locations: [
          { label: '인사캠', detail: '600주년기념관 재무팀' },
          { label: '자과캠', detail: '학생회관 재무팀' },
        ],
        details: {
          target: null,
          action: '등록금 납부',
          host: null,
          impact: null,
        },
        model: 'gpt-4.1-mini',
        generatedAt: '2026-02-01T00:00:00Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.periods).toHaveLength(2);
    expect(detail.summary?.periods[0].label).toBe('1차 납부');
    expect(detail.summary?.periods[1].label).toBe('2차 추가 납부');
    expect(detail.summary?.locations).toHaveLength(2);
    expect(detail.summary?.locations[0]).toEqual({
      label: '인사캠',
      detail: '600주년기념관 재무팀',
    });
  });

  it('parses deadline-only period with empty locations (Sample 3: 안전교육)', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-09',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-09T00:00:00Z',
      editInfo: null,
      summary: {
        text: '전체 재학생은 LMS에서 안전교육을 4월 20일까지 이수해야 해요.',
        oneLiner: '2026-04-20까지 안전교육 이수 필수',
        type: 'action_required',
        periods: [
          {
            label: null,
            startDate: null,
            startTime: null,
            endDate: '2026-04-20',
            endTime: null,
          },
        ],
        locations: [],
        details: {
          target: '전체 재학생',
          action: 'LMS에서 안전교육 이수',
          host: null,
          impact: '미이수 시 수강신청 제한',
        },
        model: 'gpt-4.1-mini',
        generatedAt: '2026-04-09T11:52:02.769Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.periods[0].endDate).toBe('2026-04-20');
    expect(detail.summary?.periods[0].startDate).toBeNull();
    expect(detail.summary?.locations).toEqual([]);
    expect(detail.summary?.details).toEqual({
      target: '전체 재학생',
      action: 'LMS에서 안전교육 이수',
      host: null,
      impact: '미이수 시 수강신청 제한',
    });
  });

  it('returns null details when AI returned no structured info', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-09',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-09T00:00:00Z',
      editInfo: null,
      summary: {
        text: 't',
        oneLiner: 'o',
        type: 'informational',
        periods: [],
        locations: [],
        details: null,
        model: 'gpt-4.1-mini',
        generatedAt: '2026-04-09T11:52:02.769Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.details).toBeNull();
    expect(detail.summary?.periods).toEqual([]);
    expect(detail.summary?.locations).toEqual([]);
  });

  it('ignores unknown extra keys inside details (forward-compat)', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-09',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-09T00:00:00Z',
      editInfo: null,
      summary: {
        text: 't',
        oneLiner: 'o',
        type: 'informational',
        periods: [],
        locations: [],
        details: {
          target: 'A',
          action: null,
          host: null,
          impact: null,
          // Forward-compat: server adds new field later
          newFutureField: 'should be ignored',
          anotherField: 42,
        },
        model: 'gpt-4.1-mini',
        generatedAt: '2026-04-09T11:52:02.769Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.details).toEqual({
      target: 'A',
      action: null,
      host: null,
      impact: null,
    });
    // Should NOT include newFutureField
    expect(detail.summary?.details).not.toHaveProperty('newFutureField');
    // Should NOT include the removed location field
    expect(detail.summary?.details).not.toHaveProperty('location');
  });

  it('parsePeriods returns [] for non-array input', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-09',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-09T00:00:00Z',
      editInfo: null,
      summary: {
        text: 't',
        oneLiner: 'o',
        type: 'informational',
        periods: 'not-an-array',
        locations: null,
        details: null,
        model: 'gpt-4.1-mini',
        generatedAt: '2026-04-09T11:52:02.769Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.periods).toEqual([]);
    expect(detail.summary?.locations).toEqual([]);
  });

  it('parseLocations filters out entries with empty detail', () => {
    const raw = envelope({
      id: 'abc',
      deptId: 'skku-main',
      articleNo: 1,
      title: 't',
      category: null,
      author: null,
      department: null,
      date: '2026-04-09',
      views: 0,
      contentMarkdown: null,
      attachments: [],
      sourceUrl: 'https://x',
      lastModified: null,
      crawledAt: '2026-04-09T00:00:00Z',
      editInfo: null,
      summary: {
        text: 't',
        oneLiner: 'o',
        type: 'informational',
        periods: [],
        locations: [
          { label: null, detail: '경영관 33101호' },
          { label: null, detail: '' },
          { label: null, detail: '   ' },
          { label: '본관', detail: '학생회관' },
        ],
        details: null,
        model: 'gpt-4.1-mini',
        generatedAt: '2026-04-09T11:52:02.769Z',
      },
    });
    const detail = parseNoticeDetail(raw);
    expect(detail.summary?.locations).toEqual([
      { label: null, detail: '경영관 33101호' },
      { label: '본관', detail: '학생회관' },
    ]);
  });
});
