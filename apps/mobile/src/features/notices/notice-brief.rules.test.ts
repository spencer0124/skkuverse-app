import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import dummies from './__fixtures__/notice-briefs.json';
import detail from './__fixtures__/notice-detail.json';
import { noticeDetailSchema } from './notices.schema';
import {
  hasNoticeBriefRefs,
  hasViewAllUnderBullets,
  toFullBodyMarkdown,
  toNoticeBrief,
  toNoticeBriefParts,
  toPostedMonthDay,
} from './notice-brief.rules';
import type { NoticeBrief } from './notice-brief.types';
import type { NoticeDetail } from './notices.types';

const notice = parseOrThrow(noticeDetailSchema, detail.data, 'notices.detail');
const all = dummies.map((raw) => parseOrThrow(noticeDetailSchema, raw, 'notices.dummy'));
const briefs = all.map((dummy) => toNoticeBrief({ notice: dummy, boardName: null }));
const briefOf = (overrides: Partial<NoticeDetail>): NoticeBrief =>
  toNoticeBrief({ notice: { ...notice, ...overrides }, boardName: null });

describe('toPostedMonthDay', () => {
  it('reads the KST calendar day from a bare date or from KST midnight', () => {
    // Act & Assert
    expect(toPostedMonthDay('2026-11-19')).toEqual({ month: 11, day: 19 });
    expect(toPostedMonthDay('2026-03-05T00:00:00+09:00')).toEqual({ month: 3, day: 5 });
  });

  it('gives null for a date it cannot read, so the caller drops the segment', () => {
    // Act & Assert
    expect(toPostedMonthDay('')).toBeNull();
    expect(toPostedMonthDay('not a date')).toBeNull();
  });
});

describe('toFullBodyMarkdown', () => {
  it('puts the posters above the body, with their size hint', () => {
    // Arrange
    const body = {
      markdown: 'See the poster.',
      posters: [
        { url: 'https://example.com/a.png', width: 600, height: 850 },
        { url: 'https://example.com/b.png', width: null, height: null },
      ],
    };

    // Act
    const markdown = toFullBodyMarkdown(body);

    // Assert
    expect(markdown).toBe('![{600x850}](https://example.com/a.png)\n\n![](https://example.com/b.png)\n\nSee the poster.');
  });

  it('is null when there is neither a body nor a poster', () => {
    // Act & Assert
    expect(toFullBodyMarkdown({ markdown: '  ', posters: [] })).toBeNull();
    expect(toFullBodyMarkdown({ markdown: null, posters: [] })).toBeNull();
  });
});

describe('toNoticeBriefParts', () => {
  const bare = briefOf({ schedule: null, brief: null, audience: null, refs: null, attachments: [], contentMarkdown: null });
  const answer = { language: 'ko' as const, bullets: [{ text: 'a' }] };
  const audience = { level: { include: ['grad' as const] }, status: { include: [], exclude: [] } };
  const schedule = [
    { id: 'a', title: '설명회', status: 'scheduled' as const, start: { date: '2026-12-02' }, occurrences: [], omittedCount: 0 },
  ];

  const partsOf = (brief: NoticeBrief, hasFullBody: boolean) => toNoticeBriefParts(brief, hasFullBody).map(({ part }) => part);
  const links = { ...bare.refs, links: [{ url: 'a.example', domain: 'a.example' }] };

  it('orders the audience, the timeline, the bullets, the refs and the full text, leaving out each one with nothing to show', () => {
    // Act & Assert
    expect(partsOf(bare, false)).toEqual([]);
    expect(partsOf({ ...bare, answer }, false)).toEqual(['bullets']);
    expect(partsOf({ ...bare, audience }, false)).toEqual(['audience']);
    expect(partsOf({ ...bare, schedule, answer, audience, refs: links }, false)).toEqual(['audience', 'schedule', 'bullets', 'refs']);
  });

  it('puts the way to the full text under the bullets, and at the end only when there are no bullets', () => {
    // Act & Assert
    expect(hasViewAllUnderBullets({ ...bare, answer }, true)).toBe(true);
    expect(partsOf({ ...bare, answer, refs: links }, true)).toEqual(['bullets', 'refs']);
    expect(hasViewAllUnderBullets(bare, true)).toBe(false);
    expect(partsOf({ ...bare, refs: links }, true)).toEqual(['refs', 'body']);
    expect(hasViewAllUnderBullets({ ...bare, answer }, false)).toBe(false);
  });

  it('keeps a poster at the end, under the refs, even with bullets', () => {
    // Arrange
    const poster = { url: 'https://example.com/a.png', width: null, height: null };

    // Act & Assert
    expect(partsOf({ ...bare, answer, body: { markdown: null, posters: [poster] } }, true)).toEqual(['bullets', 'body']);
  });

  it('draws a divider between parts, except between the audience and the timeline', () => {
    // Act
    const slots = toNoticeBriefParts({ ...bare, schedule, answer, audience }, false);

    // Assert
    expect(slots).toEqual([
      { part: 'audience', hasDividerBefore: false },
      { part: 'schedule', hasDividerBefore: false },
      { part: 'bullets', hasDividerBefore: true },
    ]);
    expect(toNoticeBriefParts({ ...bare, schedule, answer }, false)).toEqual([
      { part: 'schedule', hasDividerBefore: false },
      { part: 'bullets', hasDividerBefore: true },
    ]);
  });
});

describe('toNoticeBrief', () => {
  it('carries a notice over with its attachments, its refs and its audience', () => {
    // Arrange
    const refs = { links: [{ url: 'https://a.example/x', domain: 'a.example' }], phones: [{ value: '02-1-2' }], emails: [{ value: 'a@b.c' }] };
    const audience = { level: { include: ['undergrad' as const] }, status: { include: [], exclude: [] } };

    // Act
    const brief = toNoticeBrief({ notice: { ...notice, refs, audience }, boardName: 'Board' });

    // Assert
    expect(brief.title).toBe(notice.title);
    expect(brief.source.boardName).toBe('Board');
    expect(brief.source.url).toBe(notice.sourceUrl);
    expect(brief.refs).toEqual({ attachments: notice.attachments, ...refs });
    expect(brief.audience).toEqual(audience);
  });

  it('has only the attachments when the notice has no refs', () => {
    // Act
    const brief = briefOf({ refs: null });

    // Assert
    expect(brief.refs).toEqual({ attachments: notice.attachments, links: [], phones: [], emails: [] });
  });

  it('carries the schedule the notice came with', () => {
    // Arrange
    const schedule = [
      { id: 'a', title: '설명회', status: 'scheduled' as const, start: { date: '2026-12-02' }, occurrences: [{ start: { date: '2026-12-02' } }], omittedCount: 0 },
    ];

    // Act & Assert
    expect(briefOf({ schedule }).schedule).toEqual(schedule);
  });
});

describe('toNoticeBrief answer', () => {
  it('takes the language and the bullets of the brief the server sent', () => {
    // Arrange
    const sent = { language: null, bullets: [{ text: '12/5까지' }] };

    // Act & Assert
    expect(briefOf({ brief: sent }).answer).toEqual(sent);
  });

  it('has no answer when the brief is null, so nothing shows, not even an empty-state line', () => {
    // Act & Assert
    expect(briefOf({ brief: null }).answer).toBeNull();
  });

  it('has no answer when the brief has no bullets, since a heading over nothing says nothing', () => {
    // Act & Assert
    expect(briefOf({ brief: { language: 'ko', bullets: [] } }).answer).toBeNull();
  });
});

describe('the dummy notices', () => {
  it('are read whole by the real parser, each at a unique notice path', () => {
    // Act & Assert
    expect(all).toHaveLength(dummies.length);
    expect(new Set(all.map((d) => `${d.sourceId}/${d.articleNo}`)).size).toBe(all.length);
    for (const dummy of all) {
      expect(dummy.sourceUrl).toMatch(/^https:\/\//);
      expect(dummy.brief?.bullets.length ?? 0).toBeLessThanOrEqual(3);
    }
  });

  it('keep skku-main 139500 with every block null', () => {
    // Act
    const dummy = all.find((d) => d.sourceId === 'skku-main' && d.articleNo === 139500);

    // Assert
    expect(dummy).toMatchObject({ schedule: null, brief: null, audience: null, refs: null });
  });

  it("cover today's server: a brief in its shape, and refs found in the body", () => {
    // Arrange
    const today = dummies.filter((raw) => !('refs' in raw));

    // Act
    const parsed = today.map((raw) => parseOrThrow(noticeDetailSchema, raw, 'notices.dummy'));

    // Assert
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.some((d) => d.brief !== null && d.refs !== null)).toBe(true);
  });

  it('cover the next wire: an English brief, an exclusion, a link with no scheme, two phones, a long title', () => {
    // Act & Assert
    expect(all.some((d) => d.brief?.language === 'en')).toBe(true);
    expect(all.some((d) => (d.audience?.status.exclude.length ?? 0) > 0)).toBe(true);
    expect(all.some((d) => d.refs?.links.some((l) => !/^https?:/.test(l.url)))).toBe(true);
    expect(briefs.some((b) => hasNoticeBriefRefs(b) && b.refs.phones.length >= 2)).toBe(true);
    expect(all.some((d) => d.title.length >= 60)).toBe(true);
  });
});
