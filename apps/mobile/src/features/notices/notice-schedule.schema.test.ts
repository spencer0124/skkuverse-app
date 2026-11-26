import { describe, expect, it } from 'vitest';
import { noticeDetailSchema } from './notices.schema';

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
  start: { date: '2026-12-02', time: '15:00' },
  end: { date: '2026-12-02', time: '17:00' },
  except: [],
  slots: [{ start: { date: '2026-12-02', time: '15:00' }, text: '개회' }],
  status: 'scheduled',
  place: { text: '국제관 9B217', name: '국제관', mapTarget: { skkuId: 9, spaceCd: '9B217' } },
};

describe('noticeDetailSchema schedule', () => {
  it('keeps a schedule as the server sent it', () => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [goodItem] });

    // Assert
    expect(detail.schedule).toEqual([goodItem]);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['absent, from an older server', undefined],
    ['not a list', { id: 'a1' }],
  ])('reads %s as no schedule and never fails the screen', (_name, schedule) => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule });

    // Assert
    expect(detail.schedule).toBeNull();
    expect(detail.title).toBe('t');
  });

  it.each<[string, unknown]>([
    ['a status this build lacks', { ...goodItem, status: 'postponed' }],
    ['no start', { ...goodItem, start: undefined }],
    ['a malformed date', { ...goodItem, start: { date: 'tomorrow' } }],
  ])('drops an item with %s and keeps the rest', (_name, bad) => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, schedule: [bad, goodItem] });

    // Assert
    expect(detail.schedule).toEqual([goodItem]);
  });
});
