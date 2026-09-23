/**
 * The festival place sheet's decisions.
 *
 * Three rules worth pinning, because each fails quietly in the UI:
 *
 * - A window's START decides its festival day. A 주점 open 18:00–00:00 ends on
 *   the next date, and counting that end would put every pub on both days.
 * - `facts` is always in the section list. 56 of the 67 served places have no
 *   detail, and dropping the section took their opening hours with it.
 * - An unknown block type drops alone. An exhaustive check here would blank a
 *   whole body on an older build the day a new type ships.
 */

import { describe, expect, it } from 'vitest';
import {
  dayLabelOf,
  festivalDaysOf,
  firstImageUrl,
  highlightBlock,
  kstDateKey,
  placeSections,
} from '../placeDetail';
import { MOCK_PLACE_DETAILS } from '../mock/placeDetails';
import type { PlaceBlock, PlaceDetail } from '../../types/placeDetail';
import type { I18nText } from '../../types/map';

const ko = (s: string): I18nText => ({ ko: s, en: s });
const w = (startAt: string, endAt: string) => ({ startAt, endAt });

const DAY1_BAR = w('2026-08-27T18:00:00+09:00', '2026-08-28T00:00:00+09:00');
const DAY2_BAR = w('2026-08-28T18:00:00+09:00', '2026-08-29T00:00:00+09:00');
const DAY1_BOOTH = w('2026-08-27T11:00:00+09:00', '2026-08-27T18:00:00+09:00');
const DAYS = ['2026-08-27', '2026-08-28'];

function detail(overrides: Partial<PlaceDetail> = {}): PlaceDetail {
  return {
    placeId: 'p',
    kind: 'booth',
    org: null,
    isUnion: false,
    locationLabel: null,
    actions: [],
    blocks: [],
    ...overrides,
  };
}

const textBlock = (id: string): PlaceBlock => ({ type: 'text', id, title: null, body: ko('소개') });
const listBlock = (id: string): PlaceBlock => ({
  type: 'list',
  id,
  title: null,
  items: [{ emoji: null, title: ko('게임'), description: null }],
});
const tableBlock = (id: string): PlaceBlock => ({
  type: 'table',
  id,
  title: null,
  rows: [{ label: ko('닭꼬치'), value: ko('5,000원') }],
});
const imageBlock = (id: string, url: string): PlaceBlock => ({
  type: 'image',
  id,
  title: null,
  url,
  caption: null,
});

describe('kstDateKey', () => {
  it('reads the KST calendar day, not the UTC one', () => {
    // 2026-08-27 23:30 KST is still the 27th in Seoul and 14:30 UTC.
    expect(kstDateKey(Date.parse('2026-08-27T23:30:00+09:00'))).toBe('2026-08-27');
    // 2026-08-28 00:30 KST is the 28th in Seoul but still the 27th in UTC.
    expect(kstDateKey(Date.parse('2026-08-28T00:30:00+09:00'))).toBe('2026-08-28');
  });
});

describe('festivalDaysOf', () => {
  it('collects start days only, ascending and unique', () => {
    const places = [{ hours: [DAY2_BAR] }, { hours: [DAY1_BAR, DAY2_BAR] }, { hours: [DAY1_BOOTH] }];
    expect(festivalDaysOf(places)).toEqual(DAYS);
  });

  it('does not add the day a midnight-crossing window ends on', () => {
    expect(festivalDaysOf([{ hours: [DAY2_BAR] }])).toEqual(['2026-08-28']);
  });

  it('skips always-open places and unparseable bounds', () => {
    expect(festivalDaysOf([{ hours: [] }, { hours: [w('garbage', 'garbage')] }])).toEqual([]);
  });
});

describe('dayLabelOf', () => {
  it('names the single day a place opens on', () => {
    expect(dayLabelOf([DAY1_BAR], DAYS)).toEqual({ type: 'days', days: [1] });
    expect(dayLabelOf([DAY2_BAR], DAYS)).toEqual({ type: 'days', days: [2] });
  });

  it('says every day when the place covers them all', () => {
    expect(dayLabelOf([DAY1_BAR, DAY2_BAR], DAYS)).toEqual({ type: 'all', count: 2 });
  });

  it('is silent for a one-day festival, an always-open place, and an unknown day', () => {
    expect(dayLabelOf([DAY1_BAR], ['2026-08-27'])).toBeNull();
    expect(dayLabelOf([], DAYS)).toBeNull();
    expect(dayLabelOf([w('2026-09-01T11:00:00+09:00', '2026-09-01T12:00:00+09:00')], DAYS)).toBeNull();
  });

  it('lists non-adjacent days in order', () => {
    const days = ['2026-08-27', '2026-08-28', '2026-08-29'];
    const day3 = w('2026-08-29T11:00:00+09:00', '2026-08-29T12:00:00+09:00');
    expect(dayLabelOf([day3, DAY1_BOOTH], days)).toEqual({ type: 'days', days: [1, 3] });
  });
});

describe('placeSections', () => {
  // The regression that matters: 56 of the 67 served places have no detail, and
  // every one of them carries `hours` on the overlay wire. Returning an empty
  // list here is what used to drop the facts card, and with it the opening
  // times of five sixths of the map.
  it('gives a place with no detail its facts, so the hours still show', () => {
    expect(placeSections(null)).toEqual(['facts']);
  });

  it('gives a place with an empty body its facts alone', () => {
    expect(placeSections(detail())).toEqual(['facts']);
  });

  it('adds the body when there is one', () => {
    expect(placeSections(detail({ blocks: [textBlock('a')] }))).toEqual(['facts', 'blocks']);
  });

  it('starts every ESKARA mock with facts', () => {
    for (const place of Object.values(MOCK_PLACE_DETAILS)) {
      expect(placeSections(place)[0]).toBe('facts');
    }
  });
});

describe('highlightBlock', () => {
  it('has nothing to lift out of an empty body', () => {
    expect(highlightBlock([])).toBeNull();
  });

  it('has nothing to lift out of prose alone', () => {
    expect(highlightBlock([textBlock('a'), textBlock('b')])).toBeNull();
  });

  it('lifts a list', () => {
    expect(highlightBlock([textBlock('a'), listBlock('b')])?.id).toBe('b');
  });

  it('lifts a table', () => {
    expect(highlightBlock([textBlock('a'), tableBlock('b')])?.id).toBe('b');
  });

  // The operator chooses the highlight by ordering their blocks, which is what
  // replaced the old per-kind fallback table.
  it('lets the authored order decide between a list and a table', () => {
    expect(highlightBlock([tableBlock('t'), listBlock('l')])?.id).toBe('t');
    expect(highlightBlock([listBlock('l'), tableBlock('t')])?.id).toBe('l');
  });

  // An older build must drop the one block it cannot draw, never the body. An
  // exhaustive `never` here is what would blank the whole sheet.
  it('walks past a block type it does not know', () => {
    const unknown = { type: 'video', id: 'v' } as unknown as PlaceBlock;
    expect(highlightBlock([unknown, listBlock('l')])?.id).toBe('l');
  });
});

describe('firstImageUrl', () => {
  it('is null without an image', () => {
    expect(firstImageUrl([textBlock('a')])).toBeNull();
  });

  it('takes the first image, whatever else is around it', () => {
    const blocks = [textBlock('a'), imageBlock('i1', 'one.png'), imageBlock('i2', 'two.png')];
    expect(firstImageUrl(blocks)).toBe('one.png');
  });
});
