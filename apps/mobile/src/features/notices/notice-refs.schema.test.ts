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
  contentMarkdown: '신청: https://apply.example.edu/form 문의 02-760-1234, help@example.edu',
  attachments: [],
  sourceUrl: 'https://example.edu/1',
  lastModified: null,
  crawledAt: '2026-11-26T00:00:00Z',
  editInfo: null,
};

describe('noticeDetailSchema refs', () => {
  it("reads the server's refs and leaves the body alone", () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      refs: {
        links: [{ url: 'www.snukdt.com', domain: 'snukdt.com' }],
        phones: [{ value: '02-740-1724', future: 1 }],
        emails: [{ value: 'dellik@skku.edu' }],
        version: 'refs-2',
      },
    });

    // Assert
    expect(detail.refs).toEqual({
      links: [{ url: 'www.snukdt.com', domain: 'snukdt.com' }],
      phones: [{ value: '02-740-1724' }],
      emails: [{ value: 'dellik@skku.edu' }],
    });
  });

  it('shows nothing for a missing block, null, an empty block and a malformed one, never reading the body', () => {
    // Act & Assert
    expect(noticeDetailSchema.parse(base).refs).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, refs: null }).refs).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, refs: { links: [], phones: [], emails: [] } }).refs).toBeNull();
    expect(noticeDetailSchema.parse({ ...base, refs: 'x' }).refs).toBeNull();
  });

  it('drops an item with no string value alone, and keeps every string as sent', () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      refs: { links: [{ url: 7 }], phones: [{ value: 7 }, { value: '없음' }, { value: '02-1' }], emails: ['a@b.c', { value: 'x@y.z' }] },
    });

    // Assert
    expect(detail.refs).toEqual({ links: [], phones: [{ value: '없음' }, { value: '02-1' }], emails: [{ value: 'x@y.z' }] });
  });

  it('keeps every phone and email as sent, in order, with no merging', () => {
    // Act
    const detail = noticeDetailSchema.parse({
      ...base,
      refs: {
        links: [],
        phones: [{ value: '02-760-1092' }, { value: '02.760.1092' }],
        emails: [{ value: 'janghak@example.edu' }, { value: 'Janghak@Example.edu' }],
      },
    });

    // Assert
    expect(detail.refs).toEqual({
      links: [],
      phones: [{ value: '02-760-1092' }, { value: '02.760.1092' }],
      emails: [{ value: 'janghak@example.edu' }, { value: 'Janghak@Example.edu' }],
    });
  });
});
