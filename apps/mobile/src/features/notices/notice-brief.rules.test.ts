import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import briefs from './__fixtures__/notice-briefs.json';
import detail from './__fixtures__/notice-detail.json';
import { noticeDetailSchema } from './notices.schema';
import {
  findNoticeBrief,
  hasNoticeBriefAnswerSection,
  hasNoticeBriefRefs,
  sortFormsFirst,
  toFullBodyMarkdown,
  toNoticeBrief,
  toNoticeBriefAge,
  toPostedMonthDay,
} from './notice-brief.rules';
import type { NoticeBrief } from './notice-brief.types';

const all = briefs as NoticeBrief[];
const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('toNoticeBriefAge', () => {
  it('counts minutes and hours within the same KST day', () => {
    // Arrange
    const now = kst('2026-11-19T15:00:00');

    // Act & Assert
    expect(toNoticeBriefAge('2026-11-19T14:59:30+09:00', now)).toEqual({ kind: 'justNow' });
    expect(toNoticeBriefAge('2026-11-19T14:35:00+09:00', now)).toEqual({ kind: 'minutes', count: 25 });
    expect(toNoticeBriefAge('2026-11-19T12:00:00+09:00', now)).toEqual({ kind: 'hours', count: 3 });
  });

  it('says yesterday for the previous KST day, even under 24 hours ago', () => {
    // Arrange
    const now = kst('2026-11-19T00:30:00');

    // Act & Assert
    expect(toNoticeBriefAge('2026-11-18T23:00:00+09:00', now)).toEqual({ kind: 'yesterday' });
  });

  it('shows the month and day from two days back, and the year once it differs', () => {
    // Arrange
    const now = kst('2026-11-19T10:00:00');

    // Act & Assert
    expect(toNoticeBriefAge('2026-10-19T09:12:00+09:00', now)).toEqual({ kind: 'date', label: '10/19' });
    expect(toNoticeBriefAge('2025-12-30T09:12:00+09:00', now)).toEqual({ kind: 'date', label: '25.12.30' });
  });

  it('reads the KST calendar day, not UTC', () => {
    // Arrange
    const now = kst('2026-11-19T10:00:00');

    // Act & Assert
    expect(toNoticeBriefAge('2026-11-17T01:00:00+09:00', now)).toEqual({ kind: 'date', label: '11/17' });
  });
});

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

describe('sortFormsFirst', () => {
  it('puts forms first and keeps the order within each group', () => {
    // Arrange
    const files = [
      { name: 'a.pdf', url: 'u1', isForm: false },
      { name: 'form1.hwp', url: 'u2', isForm: true },
      { name: 'b.pdf', url: 'u3', isForm: false },
      { name: 'form2.hwp', url: 'u4', isForm: true },
    ];

    // Act
    const sorted = sortFormsFirst(files);

    // Assert
    expect(sorted.map((f) => f.name)).toEqual(['form1.hwp', 'form2.hwp', 'a.pdf', 'b.pdf']);
  });
});

describe('hasNoticeBriefRefs', () => {
  it('hides the refs section when every group is empty, posters not counting as refs', () => {
    // Arrange
    const noRefs = findNoticeBrief(all, 'skku-main', 139500)!;
    const postersOnly = findNoticeBrief(all, 'skku-main', 139533)!;
    const phoneOnly = findNoticeBrief(all, 'cse-undergrad', 227019)!;

    // Act & Assert
    expect(hasNoticeBriefRefs(noRefs)).toBe(false);
    expect(hasNoticeBriefRefs(postersOnly)).toBe(false);
    expect(hasNoticeBriefRefs(phoneOnly)).toBe(true);
  });
});

describe('hasNoticeBriefAnswerSection', () => {
  const brief = findNoticeBrief(all, 'skku-main', 139500)!;

  it('shows for an answer, a poster or the way to the full body, and hides when there is none of them', () => {
    // Arrange
    const poster = { url: 'https://example.com/a.png', width: null, height: null };
    const answer = { question: null, bullets: [{ text: 'a' }] };
    const bare = { ...brief, answer: null, body: { markdown: null, posters: [] } };

    // Act & Assert
    expect(hasNoticeBriefAnswerSection({ ...bare, answer }, false)).toBe(true);
    expect(hasNoticeBriefAnswerSection({ ...bare, body: { markdown: null, posters: [poster] } }, false)).toBe(true);
    expect(hasNoticeBriefAnswerSection(bare, true)).toBe(true);
    expect(hasNoticeBriefAnswerSection(bare, false)).toBe(false);
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

describe('toNoticeBrief', () => {
  it('carries a live notice over with its attachments and the refs found in its body', () => {
    // Arrange
    const notice = parseOrThrow(noticeDetailSchema, detail.data, 'notices.detail');
    const refs = { images: [], links: [{ url: 'https://a.example/x', text: '신청하기', domain: 'a.example' }], emails: ['a@b.c'], phones: ['02-1-2'] };

    // Act
    const brief = toNoticeBrief({ notice, boardName: 'Board', refs });

    // Assert
    expect(brief.title).toBe(notice.title);
    expect(brief.source.boardName).toBe('Board');
    expect(brief.source.url).toBe(notice.sourceUrl);
    expect(brief.refs.attachments).toHaveLength(notice.attachments.length);
    expect(brief.refs.links).toEqual([{ url: 'https://a.example/x', domain: 'a.example' }]);
    expect(brief.refs.emails).toEqual([{ address: 'a@b.c', label: null }]);
    expect(brief.refs.phones).toEqual([{ number: '02-1-2', label: null }]);
  });
});

describe('toNoticeBrief answer', () => {
  const noRefs = { images: [], links: [], emails: [], phones: [] };
  const notice = parseOrThrow(noticeDetailSchema, detail.data, 'notices.detail');

  it('takes the question and the bullets of the brief the server sent', () => {
    // Arrange
    const sent = { question: '언제까지 낼까?', bullets: [{ text: '12/5까지' }] };

    // Act
    const brief = toNoticeBrief({ notice: { ...notice, brief: sent }, boardName: null, refs: noRefs });

    // Assert
    expect(brief.answer).toEqual(sent);
  });

  it('keeps a null question with its bullets', () => {
    // Act
    const brief = toNoticeBrief({ notice: { ...notice, brief: { question: null, bullets: [{ text: 'a' }] } }, boardName: null, refs: noRefs });

    // Assert
    expect(brief.answer).toEqual({ question: null, bullets: [{ text: 'a' }] });
  });

  it('has no answer when the brief is null, so nothing shows, not even an empty-state line', () => {
    // Act
    const brief = toNoticeBrief({ notice: { ...notice, brief: null }, boardName: null, refs: noRefs });

    // Assert
    expect(brief.answer).toBeNull();
  });

  it('has no answer when the brief has no bullets, since a heading over nothing says nothing', () => {
    // Act
    const brief = toNoticeBrief({ notice: { ...notice, brief: { question: '무엇을 할까?', bullets: [] } }, boardName: null, refs: noRefs });

    // Assert
    expect(brief.answer).toBeNull();
  });
});

describe('the dummy briefs', () => {
  it('keep the display rules: 0 to 5 bullets, a source URL, a unique id that a notice path can reach', () => {
    // Act & Assert
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
    for (const brief of all) {
      expect(brief.answer?.bullets.length ?? 0).toBeLessThanOrEqual(5);
      expect(brief.source.url).toMatch(/^https:\/\//);
      expect(brief.id).toMatch(/^[a-z0-9-]+-\d+$/);
    }
  });

  it('cover the null brief, the empty refs, the poster-only and the long title cases', () => {
    // Act & Assert
    expect(all.some((b) => b.answer === null && !hasNoticeBriefRefs(b))).toBe(true);
    expect(all.some((b) => b.body.posters.length >= 2)).toBe(true);
    expect(all.some((b) => b.title.length >= 60)).toBe(true);
    expect(all.some((b) => b.refs.attachments.some((a) => a.isForm))).toBe(true);
  });

  it('cover every row shape: links as a URL and a domain alone, labelled and bare phones, a labelled email, a long label', () => {
    // Arrange
    const links = all.flatMap((b) => b.refs.links);
    const phones = all.flatMap((b) => b.refs.phones);
    const emails = all.flatMap((b) => b.refs.emails);

    // Act & Assert
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => Object.keys(l).sort().join() === 'domain,url')).toBe(true);
    expect(phones.some((p) => p.label)).toBe(true);
    expect(phones.some((p) => !p.label)).toBe(true);
    expect(phones.some((p) => (p.label?.length ?? 0) >= 16)).toBe(true);
    expect(emails.some((e) => e.label)).toBe(true);
  });

  it('cover a notice with no question, and an English notice whose question and bullets are shown as sent', () => {
    // Arrange
    const english = all.filter((b) => /^[\x20-\x7E]+$/.test(b.title));

    // Act & Assert
    expect(all.some((b) => b.answer !== null && b.answer.question === null && b.answer.bullets.length > 0)).toBe(true);
    expect(english.length).toBeGreaterThan(0);
    for (const brief of english) {
      expect(brief.answer?.question).toMatch(/^[\x20-\x7E]+$/);
      expect(brief.answer?.bullets.length).toBeGreaterThanOrEqual(2);
      expect(brief.answer?.bullets.every((b) => /^[\x20-\x7E]+$/.test(b.text))).toBe(true);
    }
  });

  it('carries the schedule a live notice came with', () => {
    // Arrange
    const schedule = [
      {
        id: 'a',
        title: '설명회',
        status: 'scheduled' as const,
        start: { date: '2026-12-02' },
        occurrences: [{ start: { date: '2026-12-02' } }],
        omittedCount: 0,
      },
    ];
    const notice = { ...parseOrThrow(noticeDetailSchema, detail.data, 'notices.detail'), schedule };

    // Act
    const brief = toNoticeBrief({ notice, boardName: null, refs: { images: [], links: [], emails: [], phones: [] } });

    // Assert
    expect(brief.schedule).toEqual(schedule);
  });
});
