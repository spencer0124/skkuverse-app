import { describe, expect, it } from 'vitest';
import { noticeDetailSchema } from './notices.schema';
import { toNoticeAudienceRows } from './notice-audience.rules';

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

const audienceOf = (audience: unknown) => noticeDetailSchema.parse({ ...base, audience }).audience;

describe('noticeDetailSchema audience', () => {
  it('reads the programmes, the statuses and the excluded statuses', () => {
    // Act
    const audience = audienceOf({
      level: { include: ['grad'] },
      status: { include: ['enrolled'], exclude: ['completed', 'leave'] },
      version: 'audience-1',
    });

    // Assert
    expect(audience).toEqual({ level: { include: ['grad'] }, status: { include: ['enrolled'], exclude: ['completed', 'leave'] } });
  });

  it('drops a code this build does not know, and keeps the rest', () => {
    // Act
    const audience = audienceOf({ level: { include: ['postdoc', 'undergrad'] }, status: { include: ['exchange'], exclude: [] } });

    // Assert
    expect(audience).toEqual({ level: { include: ['undergrad'] }, status: { include: [], exclude: [] } });
  });

  it('reads a missing, null, malformed or empty audience as none', () => {
    // Act & Assert
    expect(noticeDetailSchema.parse(base).audience).toBeNull();
    expect(audienceOf(null)).toBeNull();
    expect(audienceOf({ level: 'grad' })).toBeNull();
    expect(audienceOf({ level: { include: [] }, status: { include: [], exclude: [] } })).toBeNull();
    expect(audienceOf({ level: { include: ['postdoc'] }, status: { include: [], exclude: [] } })).toBeNull();
  });
});

describe('toNoticeAudienceRows', () => {
  it('gives the programme, status and excluded rows in that order, leaving out an empty one', () => {
    // Act
    const rows = toNoticeAudienceRows({ level: { include: ['undergrad', 'grad'] }, status: { include: [], exclude: ['leave'] } });

    // Assert
    expect(rows).toEqual([
      { kind: 'level', codes: ['undergrad', 'grad'] },
      { kind: 'excludedStatus', codes: ['leave'] },
    ]);
  });
});
