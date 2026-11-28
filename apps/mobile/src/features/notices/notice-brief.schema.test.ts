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
  it("reads today's brief, keeping the text of each bullet and showing no question", () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      brief: { question: '누가 받을 수 있을까?', bullets: [{ text: '재학생', extra: 1 }, { text: '휴학생' }], future: true },
    });

    // Assert
    expect(detail.brief).toEqual({ language: null, bullets: [{ text: '재학생' }, { text: '휴학생' }] });
  });

  it('reads the next wire, which has a language and a version and no question', () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      brief: { language: 'en', bullets: [{ text: 'Apply by Friday.' }], version: 'brief-2' },
    });

    // Assert
    expect(detail.brief).toEqual({ language: 'en', bullets: [{ text: 'Apply by Friday.' }] });
  });

  it('reads a language this build does not know as none, and keeps the bullets', () => {
    // Act
    const detail = noticeDetailSchema.parse({ ...base, brief: { language: 'ja', bullets: [{ text: 'a' }] } });

    // Assert
    expect(detail.brief).toEqual({ language: null, bullets: [{ text: 'a' }] });
  });

  it('reads a null brief, a missing one from an older server, and a malformed one as no brief', () => {
    // Act & Assert
    expect(noticeDetailSchema.parse({ ...base, brief: null }).brief).toBeNull();
    expect(noticeDetailSchema.parse(base).brief).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, brief: 'text' }).brief).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, brief: { question: null, bullets: 'x' } }).brief).toBeNull();
  });

  it('drops a bullet it cannot read and keeps the rest, never failing the notice', () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      brief: { question: null, bullets: [{ text: 'a' }, 'plain', { text: 7 }, { text: 'b' }] },
    });

    // Assert
    expect(detail.brief).toEqual({ language: null, bullets: [{ text: 'a' }, { text: 'b' }] });
  });
});
