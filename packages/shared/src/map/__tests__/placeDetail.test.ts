/**
 * The festival place sheet's decisions.
 *
 * Two rules worth pinning, because each fails quietly in the UI:
 *
 * - `facts` is always in the section list. Most served places have no
 *   detail, and dropping the section took their opening hours with it.
 * - An unknown block type drops alone. An exhaustive check here would blank a
 *   whole body on an older build the day a new type ships.
 */

import { describe, expect, it } from 'vitest';
import {
  heroGallery,
  highlightBlock,
  placeBody,
  placeSections,
  placeSheetOpensTall,
  SOLO_IMAGE_DEFAULT_ASPECT,
  soloImageSize,
} from '../placeDetail';
import type { PlaceBlock, PlaceDetail } from '../../types/placeDetail';
import type { I18nText, MapOverlay } from '../../types/map';

const ko = (s: string): I18nText => ({ ko: s, en: s });

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

describe('placeSections', () => {
  // The regression that matters: most served places have no detail, and
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

describe('placeBody', () => {
  it('folds consecutive images into one gallery, in order', () => {
    // The food truck shape: a menu, then one photo per dish.
    const body = placeBody([tableBlock('menu'), imageBlock('p1', 'one.png'), imageBlock('p2', 'two.png')]);
    expect(body.map((i) => [i.type, i.id])).toEqual([
      ['block', 'menu'],
      ['gallery', 'p1'],
    ]);
    const gallery = body[1];
    expect(gallery?.type === 'gallery' && gallery.images.map((i) => i.url)).toEqual(['one.png', 'two.png']);
  });

  it('keeps an image between two other blocks a gallery of its own', () => {
    const body = placeBody([
      imageBlock('logo', 'logo.png'),
      textBlock('intro'),
      imageBlock('p1', 'one.png'),
    ]);
    expect(body.map((i) => [i.type, i.id])).toEqual([
      ['gallery', 'logo'],
      ['block', 'intro'],
      ['gallery', 'p1'],
    ]);
  });
});

describe('heroGallery', () => {
  it('is null without an image', () => {
    expect(heroGallery(placeBody([textBlock('a')]))).toBeNull();
  });

  it('takes the first gallery, whatever else is around it', () => {
    const body = placeBody([textBlock('a'), imageBlock('i1', 'one.png'), textBlock('b'), imageBlock('i2', 'two.png')]);
    expect(heroGallery(body)?.id).toBe('i1');
  });
});

describe('soloImageSize — a lone photo keeps its own shape', () => {
  it('fills the width when the height allows it', () => {
    expect(soloImageSize(4 / 5, 320, 440)).toEqual({ width: 320, height: 400 });
  });

  it('narrows a tall image to the height cap instead of cropping it', () => {
    const { width, height } = soloImageSize(1 / 3, 320, 440);
    expect(height).toBeCloseTo(440);
    expect(width).toBeCloseTo(440 / 3);
  });

  it('keeps a landscape image at the full width', () => {
    expect(soloImageSize(4 / 3, 320, 440)).toEqual({ width: 320, height: 240 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('falls back to a poster for aspect %s', (aspect) => {
    expect(soloImageSize(aspect, 320, 440)).toEqual(soloImageSize(SOLO_IMAGE_DEFAULT_ASPECT, 320, 440));
  });
});

describe('placeSheetOpensTall — a pin that names an area opens the sheet tall', () => {
  type Marker = Extract<MapOverlay, { kind: 'marker' }>;
  const base: Omit<Marker, 'kind' | 'lat' | 'lng' | 'pinPriority' | 'locationAccuracy'> = {
    id: 'p',
    layerId: 'eskara26_food',
    campus: 'nsc',
    text: { ko: 'p', en: 'p' },
    subtitle: null,
    hours: [],
    fields: [],
    actions: [],
    order: 0,
    facets: {},
    orderByOption: {},
    tap: { kind: 'event', placeId: 'p' },
  };
  const marker = (locationAccuracy: 'exact' | 'area'): MapOverlay => ({
    ...base,
    kind: 'marker',
    lat: 37.29,
    lng: 126.97,
    pinPriority: 20,
    locationAccuracy,
  });

  it('opens tall for an area pin — a food truck, placed on the day', () => {
    expect(placeSheetOpensTall(marker('area'))).toBe(true);
  });

  it('opens low for an exact pin, which the low detent keeps in view', () => {
    expect(placeSheetOpensTall(marker('exact'))).toBe(false);
  });

  it('opens low for a zone, which the map above the sheet shows itself', () => {
    // Only `kind` matters to the rule, so the ring's shape is not built out.
    const zone = { ...base, kind: 'polygon' } as unknown as MapOverlay;
    expect(placeSheetOpensTall(zone)).toBe(false);
  });

  it('opens low when there is no place yet', () => {
    expect(placeSheetOpensTall(null)).toBe(false);
  });
});
