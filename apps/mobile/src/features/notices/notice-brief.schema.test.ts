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

describe('noticeDetailSchema brief', () => {
  it('keeps the question and the text of each bullet, and ignores any other key', () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      brief: { question: '누가 받을 수 있을까?', bullets: [{ text: '재학생', extra: 1 }, { text: '휴학생' }], future: true },
    });

    // Assert
    expect(detail.brief).toEqual({ question: '누가 받을 수 있을까?', bullets: [{ text: '재학생' }, { text: '휴학생' }] });
  });

  it('keeps a null question, so the bullets show with no heading', () => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, brief: { question: null, bullets: [{ text: 'a' }] } });

    // Assert
    expect(detail.brief).toEqual({ question: null, bullets: [{ text: 'a' }] });
  });

  it('reads a null brief, a missing one from an older server, and a malformed one as no brief', () => {
    // Act & Assert
    expect(noticeDetailSchema.parse({ ...base, brief: null }).brief).toBeNull();
    expect(noticeDetailSchema.parse(base).brief).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, brief: 'text' }).brief).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, brief: { question: 3, bullets: [] } }).brief).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, brief: { question: null, bullets: 'x' } }).brief).toBeNull();
  });

  it('drops a bullet it cannot read and keeps the rest, never failing the notice', () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      brief: { question: null, bullets: [{ text: 'a' }, 'plain', { text: 7 }, { text: 'b' }] },
    });

    // Assert
    expect(detail.brief).toEqual({ question: null, bullets: [{ text: 'a' }, { text: 'b' }] });
  });
});
