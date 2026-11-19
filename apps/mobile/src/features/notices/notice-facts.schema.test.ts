/**
 * The list `row` (umbrella ADR 0009), read through the notice parser from the
 * server's published fixture and the tolerance cases. A row the build cannot
 * read is null, and its notice survives.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import listRows from './__fixtures__/notice-list-rows.json';
import { multiSourceNoticePageSchema } from './notices.schema';

const readPage = (notices: unknown[]) =>
  parseOrThrow(multiSourceNoticePageSchema, { notices, nextCursor: null, hasMore: false }, 'notices.multiPage');

const item = listRows.data.notices[0];
const rowOf = (row: unknown) => readPage([{ ...item, row }]).notices[0]?.row;
const validRow = item.row;

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
