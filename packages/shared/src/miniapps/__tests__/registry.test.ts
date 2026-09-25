import { describe, it, expect } from 'vitest';
import {
  parseMiniAppIndex,
  parseMiniAppDetail,
  MINIAPP_REGISTRY_VERSION,
} from '../schema';

/**
 * The registry moved server-side, so there is no bundled JSON left to assert
 * referential integrity against — that check now runs at server boot
 * (skkuverse-server `assertValidRegistry`, which throws).
 *
 * What matters on this side is the opposite property: an untrusted payload must
 * degrade rather than throw. Every case here is "the server sent something
 * wrong; does the app still render?"
 */

const validEntry = {
  id: 'hssc',
  name: '인사캠 총학생회',
  shortName: '인사캠 총학',
  order: 10,
  homeLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-home.png' },
  shellLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-shell.png' },
};

describe('parseMiniAppIndex', () => {
  it('parses a well-formed index', () => {
    const parsed = parseMiniAppIndex({ version: 1, miniApps: [validEntry] });
    expect(parsed.version).toBe(1);
    expect(parsed.miniApps).toHaveLength(1);
    expect(parsed.miniApps[0]).toMatchObject({
      id: 'hssc',
      name: '인사캠 총학생회',
      shortName: '인사캠 총학',
      homeLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-home.png' },
      shellLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-shell.png' },
    });
  });

  it('sorts by `order`, not by array position', () => {
    const parsed = parseMiniAppIndex({
      version: 1,
      miniApps: [
        { ...validEntry, id: 'c', order: 30 },
        { ...validEntry, id: 'a', order: 10 },
        { ...validEntry, id: 'b', order: 20 },
      ],
    });
    expect(parsed.miniApps.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops only the malformed entries, keeping the rest of the grid', () => {
    // The whole point of tolerant parsing: one bad row costs one tile.
    const parsed = parseMiniAppIndex({
      version: 1,
      miniApps: [
        validEntry,
        null,
        'nonsense',
        { name: 'no id', order: 1 },
        { id: 'NoUpperCase', name: 'bad slug', order: 2 },
        { id: 'noname', order: 3 },
        { ...validEntry, id: 'good2' },
      ],
    });
    expect(parsed.miniApps.map((m) => m.id)).toEqual(['hssc', 'good2']);
  });

  it('keeps an entry whose homeLogo is unusable, with homeLogo null', () => {
    // A missing logo is a cosmetic problem; dropping the tile would hide a
    // working mini-app over an image.
    for (const homeLogo of [
      undefined,
      null,
      { kind: 'bundled', key: 'hssc' },
      { kind: 'remote' },
      { kind: 'remote', uri: 'javascript:alert(1)' },
      { kind: 'remote', uri: '/miniapps/hssc.png' },
      { kind: 'emoji' },
      { kind: 'emoji', emoji: '' },
    ]) {
      const parsed = parseMiniAppIndex({
        version: 1,
        miniApps: [{ ...validEntry, homeLogo }],
      });
      expect(parsed.miniApps).toHaveLength(1);
      expect(parsed.miniApps[0].homeLogo).toBeNull();
    }
  });

  it('keeps an entry whose shellLogo is unusable, with shellLogo null', () => {
    for (const shellLogo of [
      undefined,
      null,
      { kind: 'bundled', key: 'hssc' },
      { kind: 'remote', uri: 'javascript:alert(1)' },
    ]) {
      const parsed = parseMiniAppIndex({
        version: 1,
        miniApps: [{ ...validEntry, shellLogo }],
      });
      expect(parsed.miniApps).toHaveLength(1);
      expect(parsed.miniApps[0].shellLogo).toBeNull();
    }
  });

  it('parses homeLogo and shellLogo independently — one unusable does not null the other', () => {
    const parsed = parseMiniAppIndex({
      version: 1,
      miniApps: [
        {
          ...validEntry,
          homeLogo: { kind: 'emoji', emoji: '🌊' },
          shellLogo: { kind: 'remote', uri: 'javascript:alert(1)' },
        },
      ],
    });
    expect(parsed.miniApps[0].homeLogo).toEqual({ kind: 'emoji', emoji: '🌊' });
    expect(parsed.miniApps[0].shellLogo).toBeNull();
  });

  it('parses an emoji logo for both homeLogo and shellLogo', () => {
    const parsed = parseMiniAppIndex({
      version: 1,
      miniApps: [
        {
          ...validEntry,
          homeLogo: { kind: 'emoji', emoji: '😋' },
          shellLogo: { kind: 'emoji', emoji: '😋' },
        },
      ],
    });
    expect(parsed.miniApps[0].homeLogo).toEqual({ kind: 'emoji', emoji: '😋' });
    expect(parsed.miniApps[0].shellLogo).toEqual({ kind: 'emoji', emoji: '😋' });
  });

  it('returns an empty registry for a malformed envelope instead of throwing', () => {
    for (const raw of [null, undefined, 42, 'nope', {}, { miniApps: 'no' }]) {
      expect(() => parseMiniAppIndex(raw)).not.toThrow();
      expect(parseMiniAppIndex(raw).miniApps).toEqual([]);
    }
  });

  it('ignores unknown fields so the server can add them additively', () => {
    const parsed = parseMiniAppIndex({
      version: 1,
      miniApps: [{ ...validEntry, brandNewField: { nested: true } }],
      somethingElse: 123,
    });
    expect(parsed.miniApps).toHaveLength(1);
    expect(parsed.miniApps[0]).not.toHaveProperty('brandNewField');
  });

  it('falls back to the known version when the server omits it', () => {
    expect(parseMiniAppIndex({ miniApps: [] }).version).toBe(
      MINIAPP_REGISTRY_VERSION,
    );
  });

  it('keeps `hidden: true`, keeping the entry in the registry', () => {
    const parsed = parseMiniAppIndex({
      version: 1,
      miniApps: [{ ...validEntry, hidden: true }],
    });
    expect(parsed.miniApps).toHaveLength(1);
    expect(parsed.miniApps[0].hidden).toBe(true);
  });

  it('omits `hidden` when absent', () => {
    const parsed = parseMiniAppIndex({ version: 1, miniApps: [validEntry] });
    expect(parsed.miniApps[0]).not.toHaveProperty('hidden');
  });

  it('drops a non-true `hidden` value rather than coercing it, keeping the entry', () => {
    for (const hidden of ['yes', 1, false]) {
      const parsed = parseMiniAppIndex({
        version: 1,
        miniApps: [{ ...validEntry, hidden }],
      });
      expect(parsed.miniApps).toHaveLength(1);
      expect(parsed.miniApps[0]).not.toHaveProperty('hidden');
    }
  });
});

describe('parseMiniAppDetail', () => {
  const validDetail = {
    version: 1,
    id: 'skkuzine',
    startUrl: 'https://webzine.skku.edu/skkuzine/index.do',
    verified: true,
    description: '성균웹진',
    relatedLinks: [
      { url: 'https://linktr.ee/skku_webzine' },
      { label: '인스타그램', url: 'https://www.instagram.com/skku_webzine' },
    ],
    noticeBanner: { title: '6월호 발행', subtitle: '방금 · 공지' },
  };

  it('parses a well-formed detail', () => {
    const parsed = parseMiniAppDetail(validDetail);
    expect(parsed).toMatchObject({
      id: 'skkuzine',
      startUrl: 'https://webzine.skku.edu/skkuzine/index.do',
      verified: true,
    });
    expect(parsed?.relatedLinks).toHaveLength(2);
    expect(parsed?.noticeBanner?.title).toBe('6월호 발행');
  });

  it('returns null without a usable startUrl', () => {
    // startUrl goes straight into a WebView, so a non-http scheme counts as
    // absent rather than being loaded.
    for (const startUrl of [
      undefined,
      null,
      '',
      42,
      'javascript:alert(1)',
      'data:text/html,<h1>x</h1>',
      '/relative/path',
    ]) {
      expect(parseMiniAppDetail({ ...validDetail, startUrl })).toBeNull();
    }
  });

  it('returns null for a missing or non-slug id', () => {
    expect(parseMiniAppDetail({ ...validDetail, id: undefined })).toBeNull();
    expect(parseMiniAppDetail({ ...validDetail, id: 'Not A Slug' })).toBeNull();
  });

  it('drops non-http related links but keeps the rest', () => {
    const parsed = parseMiniAppDetail({
      ...validDetail,
      relatedLinks: [
        { url: 'https://ok.test' },
        { url: 'javascript:alert(1)' },
        { label: 'no url' },
        'nonsense',
        { url: 'https://also-ok.test', label: 'x' },
      ],
    });
    expect(parsed?.relatedLinks.map((l) => l.url)).toEqual([
      'https://ok.test',
      'https://also-ok.test',
    ]);
  });

  it('treats a half-filled noticeBanner as absent', () => {
    // Rendering a banner with a blank subtitle reads as a bug, not a notice.
    expect(
      parseMiniAppDetail({ ...validDetail, noticeBanner: { title: 'only' } })
        ?.noticeBanner,
    ).toBeUndefined();
  });

  it('defaults `verified` to false rather than truthy-coercing', () => {
    // The badge asserts identity; anything but a literal true must not earn it.
    for (const verified of [undefined, null, 'true', 1, {}]) {
      expect(parseMiniAppDetail({ ...validDetail, verified })?.verified).toBe(
        false,
      );
    }
  });

  it('returns null for a malformed payload instead of throwing', () => {
    for (const raw of [null, undefined, 42, 'nope', []]) {
      expect(() => parseMiniAppDetail(raw)).not.toThrow();
      expect(parseMiniAppDetail(raw)).toBeNull();
    }
  });

  it('omits `shell` entirely when the server sends none', () => {
    expect(parseMiniAppDetail(validDetail)).not.toHaveProperty('shell');
  });

  it('keeps a recognized `bar` value', () => {
    for (const bar of ['top', 'bottom', 'hide'] as const) {
      expect(
        parseMiniAppDetail({ ...validDetail, shell: { bar } })?.shell,
      ).toEqual({ bar });
    }
  });

  it('drops an unrecognized `bar` value rather than coercing it', () => {
    // Absent means "bottom" — a bad value must not silently hide chrome.
    for (const shell of [{ bar: 'left' }, { bar: true }, { bottomBar: false }]) {
      const parsed = parseMiniAppDetail({ ...validDetail, shell });
      expect(parsed).not.toHaveProperty('shell');
    }
  });

  it('drops unknown shell keys, keeping `bar`', () => {
    const parsed = parseMiniAppDetail({
      ...validDetail,
      shell: { bar: 'top', extra: 1 },
    });
    expect(parsed?.shell).toEqual({ bar: 'top' });
  });
});
