/**
 * The list filters against the bytes the server actually serves.
 *
 * `list.test.ts` and `parser.test.ts` feed hand-built shapes, one rule each.
 * This feeds `parseMapConfig` and `parseOverlayData` a real `/map/config` and
 * the real 주점 and 푸드트럭 overlays, then runs the same three functions the
 * list does. What it guards is the seam the unit suites cannot see: that the
 * server's `list`, `facets` and `orderByOption` arrive under the names and
 * shapes the parser reads — an absent key parses to "unfiltered" with no error
 * on either side, which would look like a working list with no tabs.
 *
 * Captured 2026-09-24 from skkuverse-server `dev` (lists, with 일자 and 운영
 * a single-choice date and 운영 a checklist) over the ESKARA 2026 sheet, with an activation open. The overlay
 * fixture keeps the two festival layers whose lists are populated; booths have
 * no place until the council sends them.
 *
 * A snapshot, not a contract. A failure here means the SCHEMA moved. The
 * contract is skkuverse-server `docs/reference/map-overlays-api.md` §8.8.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import { parseMapConfig, parseOverlayData } from '../parser';
import { defaultFacetSelection, filterByFacets, sortForList } from '../list';
import liveConfig from './fixtures/map-config-lists-live.json';
import liveOverlays from './fixtures/map-overlays-event-lists-live.json';

const CONFIG = parseMapConfig(liveConfig as unknown as ApiEnvelope<unknown>);
const OVERLAYS = parseOverlayData(liveOverlays as unknown as ApiEnvelope<unknown>);
const listOf = (chipId: string) => CONFIG.chips.find((c) => c.id === chipId)!.list!;
const onLayer = (layerId: string) => OVERLAYS.filter((o) => o.layerId === layerId);

describe('the live lists, parsed whole', () => {
  it('keeps every overlay', () => {
    expect(OVERLAYS).toHaveLength(liveOverlays.data.overlays.length);
  });

  it('reads each list the server authored, and none on the others', () => {
    expect(listOf('eskara26_view_bar').facets.map((f) => f.id)).toEqual(['day']);
    expect(listOf('eskara26_view_booth').facets.map((f) => [f.id, f.select])).toEqual([
      ['day', 'required'],
      ['org', 'optional'],
    ]);
    expect(listOf('eskara26_view_booth').sort).toEqual({ key: 'order', scopeFacetId: 'day' });
    expect(listOf('eskara26_view_food').sort).toEqual({ key: 'title', scopeFacetId: null });
    const withList = CONFIG.chips.filter((c) => c.list !== null).map((c) => c.id);
    expect(withList).toEqual(['eskara26_view_bar', 'eskara26_view_booth', 'eskara26_view_food']);
  });

  it('opens a booth list on today\'s day and on 운영 전체', () => {
    const booth = listOf('eskara26_view_booth');
    expect(defaultFacetSelection(booth, Date.parse('2026-09-24T12:00:00+09:00'))).toEqual({
      day: ['day1'],
      org: ['council', 'club'],
    });
    expect(defaultFacetSelection(booth, Date.parse('2026-10-02T19:00:00+09:00')).day).toEqual(['day2']);
    expect(booth.facets[0]!.options.map((o) => o.label)).toEqual(['10/1(목)', '10/2(금)']);
  });
});

describe('the live lists, filtered the way the sheet filters them', () => {
  it('puts every pub under its night, and the two-night ones under both', () => {
    const bar = listOf('eskara26_view_bar');
    const pubs = onLayer('eskara26_bar');
    const day1 = filterByFacets(pubs, bar, { day: ['day1'] });
    const day2 = filterByFacets(pubs, bar, { day: ['day2'] });
    const both = day1.filter((p) => day2.includes(p));
    // Every pub is on at least one night, and one with two windows is on both.
    expect(new Set([...day1, ...day2]).size).toBe(pubs.length);
    expect(both.every((p) => p.hours.length === 2)).toBe(true);
    expect(both.length).toBeGreaterThan(0);
  });

  it('lists the food trucks in 가나다 order', () => {
    const food = listOf('eskara26_view_food');
    const titles = sortForList(onLayer('eskara26_food'), food, { day: ['day1'] }).map((p) => p.text.ko);
    expect(titles).toEqual([...titles].sort());
    expect(titles[0]).toBe('건강가족');
  });
});
