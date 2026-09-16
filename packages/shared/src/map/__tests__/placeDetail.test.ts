/**
 * The festival place sheet's decisions.
 *
 * Three rules worth pinning, because each fails quietly in the UI:
 *
 * - A window's START decides its festival day. A 주점 open 18:00–00:00 ends on
 *   the next date, and counting that end would put every pub on both days.
 * - Tabs with nothing in them are dropped, and a place with no detail gets no
 *   tabs at all — the base skeleton a toilet shows.
 * - The highlight follows the kind's fallback order, so a booth without
 *   contents still says something while collapsed.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPlaceTabs,
  dayLabelOf,
  entryFeeRange,
  festivalDaysOf,
  formatPriceRange,
  groupThousands,
  highlightOf,
  kstDateKey,
} from '../placeDetail';
import type { PlaceDetail } from '../../types/placeDetail';
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
    intro: null,
    logoUrl: null,
    images: [],
    contents: [],
    menu: [],
    entryFees: [],
    notices: [],
    paymentMethods: [],
    instagramUrl: null,
    ...overrides,
  };
}

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

describe('buildPlaceTabs', () => {
  it('gives no tabs to a place with no detail', () => {
    expect(buildPlaceTabs(null, [DAY1_BAR])).toEqual([]);
  });

  it("keeps the server's prose for a place with no detail, as one home tab", () => {
    expect(buildPlaceTabs(null, [], 1)).toEqual([{ key: 'home', sections: ['prose'] }]);
  });

  it("puts the server's prose last in the home tab", () => {
    const d = detail({ contents: [{ title: ko('게임'), description: null }] });
    expect(buildPlaceTabs(d, [], 2)).toEqual([{ key: 'home', sections: ['contents', 'prose'] }]);
  });

  it('gives a full pub home, menu and info', () => {
    const pub = detail({
      kind: 'pub',
      org: ko('경영대학 학생회'),
      intro: ko('소개'),
      notices: [ko('사전 예약')],
      entryFees: [{ label: ko('성균인'), price: 18000 }],
    });
    expect(buildPlaceTabs(pub, [DAY1_BAR, DAY2_BAR])).toEqual([
      { key: 'home', sections: ['intro', 'notices'] },
      { key: 'menu', sections: ['menu'] },
      { key: 'info', sections: ['info'] },
    ]);
  });

  it('drops the home tab when there is nothing to put in it', () => {
    const truck = detail({
      kind: 'foodTruck',
      instagramUrl: 'https://instagram.com/x',
      menu: [{ title: null, items: [{ name: ko('닭꼬치'), price: 5000, note: null }] }],
    });
    expect(buildPlaceTabs(truck, [DAY1_BOOTH]).map((t) => t.key)).toEqual(['menu', 'info']);
  });

  it('does not count a menu group with no items', () => {
    const d = detail({ menu: [{ title: ko('메인'), items: [] }], contents: [{ title: ko('게임'), description: null }] });
    expect(buildPlaceTabs(d, []).map((t) => t.key)).toEqual(['home']);
  });

  it('leaves out an info tab that would only repeat the summary', () => {
    const medical = detail({ kind: 'facility', notices: [ko('응급 상황 시 방문')] });
    expect(buildPlaceTabs(medical, [])).toEqual([{ key: 'home', sections: ['notices'] }]);
  });

  it('earns the info tab from a second day of hours alone', () => {
    const d = detail({ contents: [{ title: ko('게임'), description: null }] });
    expect(buildPlaceTabs(d, [DAY1_BOOTH]).map((t) => t.key)).toEqual(['home']);
    expect(buildPlaceTabs(d, [DAY1_BAR, DAY2_BAR]).map((t) => t.key)).toEqual(['home', 'info']);
  });

  it('counts a logo alone as an intro', () => {
    const d = detail({ kind: 'promo', logoUrl: 'https://example.com/logo.png' });
    expect(buildPlaceTabs(d, [])).toEqual([{ key: 'home', sections: ['intro'] }]);
  });
});

describe('highlightOf', () => {
  const menu = [
    { title: ko('메인'), items: [1, 2].map((n) => ({ name: ko(`메인${n}`), price: n * 1000, note: null })) },
    { title: ko('사이드'), items: [3, 4].map((n) => ({ name: ko(`사이드${n}`), price: null, note: null })) },
  ];

  it('crosses menu groups to fill its lines', () => {
    const oneEach = [
      { title: ko('메인'), items: [{ name: ko('메인1'), price: 1000, note: null }] },
      { title: ko('사이드'), items: [{ name: ko('사이드1'), price: null, note: null }] },
    ];
    const h = highlightOf(detail({ kind: 'pub', menu: oneEach }));
    expect(h?.type === 'menu' && h.items.map((i) => i.name.ko)).toEqual(['메인1', '사이드1']);
  });

  it('leads a pub with its first menu lines, and counts the rest', () => {
    const h = highlightOf(detail({ kind: 'pub', menu, entryFees: [] }));
    expect(h).toMatchObject({ type: 'menu', more: 2, entryFee: null });
    expect(h?.type === 'menu' && h.items.map((i) => i.name.ko)).toEqual(['메인1', '메인2']);
  });

  it('carries the entry-fee range, even for a pub with no menu lines', () => {
    const fees = [
      { label: ko('원전공생'), price: 16000 },
      { label: ko('외부인'), price: 20000 },
      { label: ko('성균인'), price: 18000 },
    ];
    expect(highlightOf(detail({ kind: 'pub', entryFees: fees }))).toEqual({
      type: 'menu',
      items: [],
      more: 0,
      entryFee: { min: 16000, max: 20000 },
    });
  });

  it('limits a food truck to two lines', () => {
    const h = highlightOf(detail({ kind: 'foodTruck', menu }));
    expect(h).toMatchObject({ type: 'menu', more: 2 });
  });

  it('leads a booth with its contents and falls back to the intro', () => {
    const contents = [1, 2, 3].map((n) => ({ title: ko(`게임${n}`), description: null }));
    expect(highlightOf(detail({ contents }))).toMatchObject({ type: 'contents', more: 1 });
    expect(highlightOf(detail({ intro: ko('소개') }))).toEqual({ type: 'text', text: ko('소개') });
  });

  it('never leads a booth with a menu', () => {
    expect(highlightOf(detail({ kind: 'booth', menu }))).toBeNull();
  });

  it('leads a facility with its first notice', () => {
    const d = detail({ kind: 'facility', notices: [ko('첫째'), ko('둘째')], intro: ko('소개') });
    expect(highlightOf(d)).toEqual({ type: 'text', text: ko('첫째') });
  });

  it('has nothing to say without a detail', () => {
    expect(highlightOf(null)).toBeNull();
    expect(highlightOf(detail({ kind: 'facility' }))).toBeNull();
  });
});

describe('prices', () => {
  it('groups thousands', () => {
    expect(groupThousands(0)).toBe('0');
    expect(groupThousands(900)).toBe('900');
    expect(groupThousands(12000)).toBe('12,000');
    expect(groupThousands(1234567)).toBe('1,234,567');
  });

  it('collapses a flat range to one number', () => {
    expect(formatPriceRange({ min: 16000, max: 20000 })).toBe('16,000–20,000');
    expect(formatPriceRange({ min: 5000, max: 5000 })).toBe('5,000');
  });

  it('has no range without fees', () => {
    expect(entryFeeRange([])).toBeNull();
  });
});
