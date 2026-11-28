import { describe, expect, it } from 'vitest';
import { noticeDetailSchema } from './notices.schema';
import scheduleDetail from './__fixtures__/notice-detail.schedule.json';
import dummyBriefs from './__fixtures__/notice-briefs.json';

const base = {
  id: 'abc',
  sourceId: 'skku-main',
  articleNo: 1,
  title: 't',
  category: null,
  author: null,
  department: null,
  date: '2026-11-26',
  contentMarkdown: null,
  attachments: [],
  sourceUrl: 'https://example.edu/1',
  lastModified: null,
  crawledAt: '2026-11-26T00:00:00Z',
  editInfo: null,
};

const goodItem = {
  id: 'a1',
  title: '설명회',
  status: 'scheduled',
  start: { date: '2026-12-02', time: '15:00' },
  end: { date: '2026-12-02', time: '17:00' },
  place: { text: '국제관 9B217', name: '국제관', mapTarget: { skkuId: 9, spaceCd: '9B217' } },
  occurrences: [{ start: { date: '2026-12-02', time: '15:00' }, end: { date: '2026-12-02', time: '17:00' } }],
  omittedCount: 0,
};

/** WHY: the v1 item the server sent before v2, which this build drops. */
const v1Item = {
  id: 'a1',
  title: '설명회',
  start: { date: '2026-12-02', time: '15:00' },
  end: { date: '2026-12-02', time: '17:00' },
  precision: 'week',
  repeat: { freq: 'weekly', byDay: ['WE'] },
  except: ['2026-12-09'],
  slots: [{ start: { date: '2026-12-02', time: '15:00' }, text: '개회' }],
  status: 'scheduled',
  quote: '일정은 변동될 수 있음',
  place: { text: '국제관 9B217', name: '국제관', mapTarget: { skkuId: 9, spaceCd: '9B217' } },
};

describe('noticeDetailSchema schedule', () => {
  it('keeps what it draws of the schedule the server serves: a series, a deadline, a gap, parts and a latest day', () => {
    // Act
    const detail = noticeDetailSchema.parse(scheduleDetail.data);

    // Assert
    expect(detail.schedule).toEqual(scheduleDetail.data.schedule.map(({ rdate: _rdate, gaps: _gaps, ...read }) => read));
  });

  it('keeps a plain item as the server sent it', () => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [goodItem] });

    // Assert
    expect(detail.schedule).toEqual([goodItem]);
  });

  it('keeps an omitted count of null for a series with no end', () => {
    // Arrange
    const endless = { ...goodItem, rrule: { freq: 'daily' }, omittedCount: null };

    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [endless] });

    // Assert
    expect(detail.schedule).toEqual([endless]);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['an empty list', []],
    ['absent, from an older server', undefined],
    ['not a list', { id: 'a1' }],
  ])('reads %s as no schedule and never fails the screen', (_name, schedule) => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule });

    // Assert
    expect(detail.schedule).toBeNull();
    expect(detail.title).toBe('t');
  });

  it('reads a v1 schedule as no schedule without failing the screen', () => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [v1Item, { ...v1Item, id: 'a2' }] });

    // Assert
    expect(detail.schedule).toBeNull();
    expect(detail.title).toBe('t');
  });

  it('keeps a v2 item beside a v1 one in the same list', () => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [v1Item, goodItem] });

    // Assert
    expect(detail.schedule).toEqual([goodItem]);
  });

  it.each<[string, unknown]>([
    ['a status this build lacks', { ...goodItem, status: 'postponed' }],
    ['neither a start nor an end', { ...goodItem, start: undefined, end: undefined }],
    ['a series with no start', { ...goodItem, start: undefined, rrule: { freq: 'weekly' } }],
    ['a frequency this build lacks', { ...goodItem, rrule: { freq: 'monthly' } }],
    ['a malformed date', { ...goodItem, start: { date: 'tomorrow' } }],
    ['no occurrences list', { ...goodItem, occurrences: undefined }],
    ['no omitted count', { ...goodItem, omittedCount: undefined }],
    ['a negative omitted count', { ...goodItem, omittedCount: -1 }],
  ])('drops an item with %s and keeps the rest', (_name, bad) => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [bad, goodItem] });

    // Assert
    expect(detail.schedule).toEqual([goodItem]);
  });

  it('drops a malformed occurrence, a part and a skipped day and keeps their item', () => {
    // Arrange
    const raw = {
      ...goodItem,
      exdate: ['2026-12-09', 'not a day'],
      occurrences: [{ start: { date: 'x' } }, goodItem.occurrences[0]],
      parts: [{ ...goodItem, id: 'p1', status: 'postponed' }, { ...goodItem, id: 'p2', occurrences: goodItem.occurrences }],
    };

    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [raw] });

    // Assert
    expect(detail.schedule).toEqual([
      {
        ...goodItem,
        exdate: ['2026-12-09'],
        parts: [{ ...goodItem, id: 'p2' }],
      },
    ]);
  });
});

describe('the dummy briefs', () => {
  it.each(dummyBriefs.filter((brief) => brief.schedule !== null).map((brief) => [brief.id, brief.schedule] as const))(
    'carry a schedule the parser reads whole, in %s',
    (_id, schedule) => {
      // Act
      const detail = noticeDetailSchema.parse({ ...base, schedule });

      // Assert
      expect(detail.schedule).toEqual(schedule);
    },
  );
});
