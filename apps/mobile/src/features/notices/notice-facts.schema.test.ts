/**
 * The list `row` and the detail `screen` (umbrella ADR 0009), read through the
 * notice parsers from the server's published fixtures and the tolerance cases.
 * A row or screen the build cannot read is null, and its notice survives.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import detail from './__fixtures__/notice-detail.json';
import detailScreen from './__fixtures__/notice-detail-screen.json';
import listRows from './__fixtures__/notice-list-rows.json';
import openCall from './__fixtures__/notice-screen-open-call.json';
import { multiSourceNoticePageSchema, noticeDetailSchema } from './notices.schema';

const readPage = (notices: unknown[]) =>
  parseOrThrow(multiSourceNoticePageSchema, { notices, nextCursor: null, hasMore: false }, 'notices.multiPage');
const readDetail = (raw: unknown) => parseOrThrow(noticeDetailSchema, raw, 'notices.detail');

const item = listRows.data.notices[0];
const rowOf = (row: unknown) => readPage([{ ...item, row }]).notices[0]?.row;
const validRow = item.row;

const screenOf = (screen: unknown) => readDetail({ ...detail.data, screen }).screen;
const validScreen = openCall.data;
const line = (overrides: Record<string, unknown>) => ({
  text: '신청서 제출',
  sub: null,
  fromPoster: false,
  actions: [],
  quote: '신청서를 제출하세요',
  ...overrides,
});
const block = (overrides: Record<string, unknown>) => ({
  label: '신청',
  numbered: false,
  footerLink: null,
  foldedCount: 0,
  lines: [line({})],
  ...overrides,
});
const screenWith = (overrides: Record<string, unknown>) => screenOf({ ...validScreen, ...overrides });

let drops: string[] = [];
beforeEach(() => {
  drops = [];
  setDropReporter((where) => drops.push(where));
});

describe('the row over the server fixture', () => {
  it('reads every row the server sent, in its order', () => {
    // Act
    const rows = readPage(listRows.data.notices).notices.map((notice) => notice.row);

    // Assert
    expect(rows).toStrictEqual([
      {
        token: { text: '오늘', tone: 'urgent' },
        title: '계절수업 타대학 학점교류',
        when: '[부산대학교] 오늘 13시 마감',
        dateMark: null,
        qualifier: '학사과정 학생으로 2개 학기 이상(3학년 편입생은 1개 학기 이상)을 이수 완료한 자',
        board: '학부통합(학사)',
        day: 'earlier',
        isUrgent: true,
        isDimmed: false,
      },
      {
        token: { text: '마감', tone: 'closed' },
        title: '이차전지산학협력연구센터 행정 직원',
        when: '10/26(월) 마감됨',
        dateMark: null,
        qualifier: '지원자격: 대졸(학사) 이상 소지자',
        board: '성균관대_통합(채용·모집)',
        day: 'earlier',
        isUrgent: false,
        isDimmed: true,
      },
      {
        token: null,
        title: '사회과학대학 수선포럼',
        when: '11/18(수) 11시 30분',
        dateMark: null,
        qualifier: '발표와 함께 간단한 식사를 하실 수 있도록 준비할 예정입니다.',
        board: '학부통합(학사)',
        day: 'yesterday',
        isUrgent: false,
        isDimmed: false,
      },
    ]);
  });
});

describe('a row this build cannot fully read', () => {
  it.each([
    ['a token with no text drops the token alone', { token: { tone: 'urgent' } }, { token: null }],
    ['an unknown tone keeps the token text in neutral ink', { token: { text: '보류', tone: 'held' } }, { token: { text: '보류', tone: null } }],
    ['an unknown day groups nowhere', { day: 'lastMonth' }, { day: null }],
    ['an unknown date mark shows no mark', { dateMark: 'guess' }, { dateMark: null }],
    ['an empty when is absent', { when: '' }, { when: null }],
    ['an empty board is absent', { board: '' }, { board: null }],
    ['a flag that is not a boolean is off', { urgent: 'yes', dimmed: 1 }, { isUrgent: false, isDimmed: false }],
  ])('%s', (_name, raw, expected) => {
    // Act
    const row = rowOf({ ...validRow, ...raw });

    // Assert
    expect(row).toMatchObject({ title: validRow.title, ...expected });
  });

  it.each([
    ['a blank title', { ...validRow, title: '' }],
    ['a number', 5],
    ['a list', []],
    ['an absent row, as an older server sends', undefined],
  ])('reads %s as no row and keeps the notice', (_name, raw) => {
    // Act
    const notices = readPage([{ ...item, row: raw }]).notices;

    // Assert
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ id: item.id, title: item.title, row: null });
  });
});

describe('the screen over the server fixtures', () => {
  it('reads the detail fixture', () => {
    // Act
    const notice = readDetail(detailScreen.data);

    // Assert
    expect(notice.screen).toStrictEqual({
      firstSeen: '10/20(화) 처음 올라옴',
      change: null,
      status: null,
      blocks: [
        {
          label: '대상',
          isNumbered: false,
          lines: [{ text: '광고업계 취업을 희망하는 누구나', sub: null, actions: [], quote: '광고업계 취업을 희망하는 누구나', source: 'body' }],
          foldedLines: [],
          footerLink: null,
        },
        {
          label: '신청',
          isNumbered: true,
          lines: [
            {
              text: '사전신청',
              sub: null,
              actions: [{ kind: 'link', url: 'https://forms.gle/WWPGKVxiUoXXLBBe6' }],
              quote: '사전신청',
              source: 'body',
            },
          ],
          foldedLines: [],
          footerLink: null,
        },
        {
          label: '언제·어디',
          isNumbered: false,
          lines: [
            {
              text: '11/6(금) 10시~18시 개최',
              sub: '잠실 한국광고문화회관 2층',
              actions: [],
              quote: '2026년 11월 6일(금) 10:00~18:00',
              source: 'body',
            },
          ],
          foldedLines: [],
          footerLink: null,
        },
      ],
      action: { label: '사전신청', action: { kind: 'link', url: 'https://forms.gle/WWPGKVxiUoXXLBBe6' } },
      collapsed: null,
      original: { posterCount: 1, attachments: [], links: [{ role: '사전신청', domain: 'forms.gle', url: 'https://forms.gle/WWPGKVxiUoXXLBBe6' }] },
      isStaffOnly: false,
      isPosterOnly: false,
    });
    expect(drops).toStrictEqual([]);
  });

  it('reads an open call with its status, an e-mail line and the bar action', () => {
    // Act
    const screen = screenOf(openCall.data);

    // Assert
    expect(screen?.status).toStrictEqual({ word: '접수 중', detail: '11/1(일) 마감', tone: 'open' });
    expect(screen?.blocks.map((b) => b.label)).toStrictEqual(['대상', '혜택', '신청', '언제·어디', '문의']);
    expect(screen?.blocks[4]?.lines[0]?.actions).toStrictEqual([{ kind: 'email', address: 'contact@example.com', subject: null }]);
    expect(screen?.action).toStrictEqual({
      label: '신청 및 운영 홈페이지 링크',
      action: { kind: 'link', url: 'https://histarter.wixsite.com/2026ericasw' },
    });
    expect(drops).toStrictEqual([]);
  });
});

describe('a screen this build cannot fully read', () => {
  it.each([
    ['a number', 5],
    ['a string', 'screen'],
    ['an absent screen, as an older server sends', undefined],
  ])('reads %s as no screen and keeps the notice', (_name, raw) => {
    // Act
    const notice = readDetail({ ...detail.data, screen: raw });

    // Assert
    expect(notice).toMatchObject({ title: detail.data.title, screen: null });
  });

  it('reads blocks that are not a list as no blocks', () => {
    // Act
    const screen = screenWith({ blocks: 'blocks' });

    // Assert
    expect(screen?.blocks).toStrictEqual([]);
  });

  it('drops and reports a block whose every line is unreadable, keeping the rest', () => {
    // Act
    const screen = screenWith({ blocks: [block({ label: '대상', lines: [{ text: '' }, 7] }), block({ label: '신청' })] });

    // Assert
    expect(screen?.blocks.map((b) => b.label)).toStrictEqual(['신청']);
    expect(drops).toContain('notices.screen.blocks');
  });

  it('keeps the first-seen day when the change is unreadable', () => {
    // Act
    const screen = screenWith({ header: { firstSeen: '9/30(수) 처음 올라옴', change: { what: '마감' } } });

    // Assert
    expect(screen).toMatchObject({ firstSeen: '9/30(수) 처음 올라옴', change: null });
  });

  it('drops a map place the app cannot open and an unknown kind silently, keeping the line', () => {
    // Act
    const screen = screenWith({
      blocks: [
        block({
          lines: [
            line({
              actions: [
                { kind: 'map', target: 'building:hssc:109' },
                { kind: 'calendar', target: '2026-11-06' },
                { kind: 'call', target: '02-760-1234' },
              ],
            }),
          ],
        }),
      ],
    });

    // Assert
    expect(screen?.blocks[0]?.lines[0]?.actions).toStrictEqual([{ kind: 'call', number: '02-760-1234' }]);
    expect(drops).toStrictEqual([]);
  });

  it('reads an unknown status tone as neutral and an unknown collapse as none', () => {
    // Act
    const screen = screenWith({ status: { word: '대기', detail: null, tone: 'waiting' }, collapsed: 'ended' });

    // Assert
    expect(screen).toMatchObject({ status: { word: '대기', detail: null, tone: 'neutral' }, collapsed: null });
  });

  it('leaves out a bar action whose target the app cannot open', () => {
    // Act
    const screen = screenWith({ action: { label: '신청하기', kind: 'link', target: 'javascript:alert(1)' } });

    // Assert
    expect(screen?.action).toBeNull();
  });
});

describe('the fields the server adds next', () => {
  it('opens a campus building with its space', () => {
    // Act
    const screen = screenWith({
      blocks: [
        block({
          lines: [
            line({
              actions: [
                { kind: 'map', target: 'skku_building:248', space: '21517' },
                { kind: 'map', target: 'skku_building:31', space: null },
              ],
            }),
          ],
        }),
      ],
    });

    // Assert
    expect(screen?.blocks[0]?.lines[0]?.actions).toStrictEqual([
      { kind: 'map', place: { kind: 'skku_building', placeId: '248' }, space: '21517' },
      { kind: 'map', place: { kind: 'skku_building', placeId: '31' }, space: null },
    ]);
  });

  it('searches the phone map app for a place off campus', () => {
    // Act
    const screen = screenWith({
      blocks: [block({ lines: [line({ actions: [{ kind: 'search', target: '잠실 한국광고문화회관' }] })] })],
    });

    // Assert
    expect(screen?.blocks[0]?.lines[0]?.actions).toStrictEqual([{ kind: 'search', query: '잠실 한국광고문화회관' }]);
  });

  it('carries an e-mail subject on a line and on the bar', () => {
    // Act
    const screen = screenWith({
      blocks: [
        block({
          lines: [
            line({
              actions: [
                { kind: 'email', target: 'a@skku.edu', subject: '[지원] 이름' },
                { kind: 'email', target: 'b@skku.edu', subject: null },
              ],
            }),
          ],
        }),
      ],
      action: { label: '메일로 지원', kind: 'email', target: 'a@skku.edu', subject: '[지원] 이름' },
    });

    // Assert
    expect(screen?.blocks[0]?.lines[0]?.actions).toStrictEqual([
      { kind: 'email', address: 'a@skku.edu', subject: '[지원] 이름' },
      { kind: 'email', address: 'b@skku.edu', subject: null },
    ]);
    expect(screen?.action).toStrictEqual({
      label: '메일로 지원',
      action: { kind: 'email', address: 'a@skku.edu', subject: '[지원] 이름' },
    });
  });

  it('reads an attachment and a link url on the original, an http one or a link a mailto', () => {
    // Act
    const screen = screenWith({
      original: {
        posterCount: 0,
        attachments: [
          { role: '신청서', name: 'form.hwp', url: 'https://skku.edu/form.hwp' },
          { role: '안내문', name: 'guide.pdf', url: null },
          { role: '포스터', name: 'poster.png' },
        ],
        links: [
          { role: '신청', domain: 'forms.gle', url: 'https://forms.gle/x' },
          { role: '안내', domain: 'skku.edu', url: 'ftp://skku.edu/x' },
          { role: '문의', domain: 'skku.edu', url: 'mailto:wise@skku.edu' },
        ],
      },
    });

    // Assert
    expect(screen?.original).toStrictEqual({
      posterCount: 0,
      attachments: [
        { role: '신청서', name: 'form.hwp', url: 'https://skku.edu/form.hwp' },
        { role: '안내문', name: 'guide.pdf', url: null },
        { role: '포스터', name: 'poster.png', url: null },
      ],
      links: [
        { role: '신청', domain: 'forms.gle', url: 'https://forms.gle/x' },
        { role: '안내', domain: 'skku.edu', url: null },
        { role: '문의', domain: 'skku.edu', url: 'mailto:wise@skku.edu' },
      ],
    });
  });

  it.each([
    ['a poster line by the live flag', { fromPoster: true }, 'poster'],
    ['a body line by the live flag', { fromPoster: false }, 'body'],
    ['a poster line by its source', { source: 'poster', fromPoster: undefined }, 'poster'],
    ['a title line by its source', { source: 'title', fromPoster: undefined }, 'title'],
    ['the source over the flag', { source: 'body', fromPoster: true }, 'body'],
    ['an unknown source by the flag', { source: 'attachment', fromPoster: true }, 'poster'],
  ])('reads %s', (_name, raw, source) => {
    // Act
    const screen = screenWith({ blocks: [block({ lines: [line(raw)] })] });

    // Assert
    expect(screen?.blocks[0]?.lines[0]?.source).toBe(source);
  });

  it.each([
    [0, 3, 0],
    [2, 1, 2],
    [3, 0, 3],
    [4, 0, 3],
    [-1, 3, 0],
  ])('folds %i of three lines as %i shown and %i folded', (foldedCount, shownCount, foldedLineCount) => {
    // Act
    const screen = screenWith({
      blocks: [block({ foldedCount, lines: [line({ text: '1' }), line({ text: '2' }), line({ text: '3' })] })],
    });

    // Assert
    expect(screen?.blocks[0]?.lines).toHaveLength(shownCount);
    expect(screen?.blocks[0]?.foldedLines).toHaveLength(foldedLineCount);
    expect([...(screen?.blocks[0]?.lines ?? []), ...(screen?.blocks[0]?.foldedLines ?? [])].map((l) => l.text)).toStrictEqual(['1', '2', '3']);
  });
});
