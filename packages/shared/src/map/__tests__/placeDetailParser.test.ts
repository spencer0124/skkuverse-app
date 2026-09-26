/**
 * `parsePlaceDetails`, the sheet bodies of `GET /map/overlays/event/details`.
 *
 * Two enums with opposite openness, and both directions are pinned here:
 *
 * - A block `type` is OPEN. An unknown one drops that block alone, so the
 *   server can ship a sixth type before every installed build can draw it.
 * - A `kind` is CLOSED. An unknown one drops the whole detail — the server
 *   refuses anything outside the same list, so this only fires on a bug.
 *
 * The live suite at the bottom feeds it a slice of what production served, for
 * the reason `live-overlays.test.ts` gives: a parser reading a key the server
 * does not send reports success and draws nothing.
 */

import { describe, expect, it } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import { parsePlaceDetails } from '../parser';
import detailsLive from './fixtures/map-overlays-event-details-live.json';

const ko = (s: string) => ({ ko: s, en: s });

function envelope(details: Record<string, unknown>): ApiEnvelope<unknown> {
  return { meta: { lang: 'ko' }, data: { details } } as unknown as ApiEnvelope<unknown>;
}

function wire(overrides: Record<string, unknown> = {}) {
  return {
    placeId: 'p',
    kind: 'foodTruck',
    org: null,
    isUnion: false,
    locationLabel: null,
    actions: [],
    blocks: [],
    ...overrides,
  };
}

const parseOne = (overrides: Record<string, unknown> = {}) =>
  parsePlaceDetails(envelope({ p: wire(overrides) })).p;

describe('parsePlaceDetails', () => {
  it('keys each detail by its own placeId', () => {
    const out = parsePlaceDetails(envelope({ a: wire({ placeId: 'a' }), b: wire({ placeId: 'b' }) }));
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('answers an empty record for a closed festival or a missing envelope', () => {
    expect(parsePlaceDetails(envelope({}))).toEqual({});
    expect(parsePlaceDetails({ data: null } as unknown as ApiEnvelope<unknown>)).toEqual({});
  });

  it('drops a whole detail whose kind this build does not know', () => {
    expect(parseOne({ kind: 'spaceship' })).toBeUndefined();
    expect(parseOne({ placeId: '' })).toBeUndefined();
  });

  it('drops an unknown block type alone and keeps the rest of the body', () => {
    const detail = parseOne({
      blocks: [
        { type: 'carousel', id: 'x', title: null },
        { type: 'text', id: 't', title: null, body: ko('소개') },
      ],
    });
    expect(detail?.blocks.map((b) => b.id)).toEqual(['t']);
  });

  it('drops a block missing what it draws, and a list with no readable row', () => {
    const detail = parseOne({
      blocks: [
        { type: 'text', id: 'no-body', title: null },
        { type: 'table', id: 'empty', title: null, rows: [{ label: ko('닭꼬치') }] },
        { type: 'image', id: 'http', title: null, url: 'http://media.skkuverse.com/a.jpg', caption: null },
        { type: 'notice', id: 'n', title: null, items: [ko('현금만 받아요'), { en: 'no ko' }] },
      ],
    });
    expect(detail?.blocks).toEqual([{ type: 'notice', id: 'n', title: null, items: [ko('현금만 받아요')] }]);
  });

  it('drops an unknown or malformed action alone', () => {
    const detail = parseOne({
      actions: [
        { type: 'tiktok', id: 'x', label: ko('틱톡') },
        { type: 'link', id: 'bad', label: ko('링크'), url: 'javascript:alert(1)' },
        {
          type: 'instagram',
          id: 'ig',
          label: ko('인스타'),
          profileUrl: 'https://www.instagram.com/skku',
          postUrl: null,
        },
      ],
    });
    expect(detail?.actions.map((a) => a.id)).toEqual(['ig']);
  });
});

describe('the live details, parsed whole', () => {
  const RAW = detailsLive.data.details as Record<string, { blocks: unknown[] }>;
  const OUT = parsePlaceDetails(detailsLive as unknown as ApiEnvelope<unknown>);

  it('keeps every detail and every block the fixture holds', () => {
    // Nothing dropped: a drop here is the parser rejecting something real.
    expect(Object.keys(OUT).sort()).toEqual(Object.keys(RAW).sort());
    for (const [id, raw] of Object.entries(RAW)) {
      expect(OUT[id]?.blocks).toHaveLength(raw.blocks.length);
    }
  });

  it('reads a truck as its menu, then its captioned photos', () => {
    const truck = OUT['eskara-2026-truck-oyabong'];
    expect(truck?.kind).toBe('foodTruck');
    expect(truck?.blocks[0]?.type).toBe('table');
    for (const block of truck?.blocks.slice(1) ?? []) {
      expect(block.type).toBe('image');
      if (block.type !== 'image') continue;
      expect(block.url.startsWith('https://media.skkuverse.com/')).toBe(true);
      expect(block.caption?.ko).toBeTruthy();
    }
  });
});
