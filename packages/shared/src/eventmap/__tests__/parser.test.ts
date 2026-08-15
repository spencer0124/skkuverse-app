/**
 * Tolerant parsing.
 *
 * The fixture is in the SERVER's wire shape — its structure members come from the
 * real `eskara-2026.json`, and every key and its order match what `materialize()`
 * emits — but the six sessions are **curated, not seeded**. `seed-eventmap-demo.js`
 * publishes fourteen, on different ids, with minute-scale offsets; this file has
 * six on round hours, chosen to cover one case each: a permanent facility, a
 * two-occupant stack, a closed window, a cancelled session with both bounds null,
 * and an upcoming one.
 *
 * So it is **maintained by hand**, and re-running the seed would not reproduce it —
 * it would replace it, taking those cases with it. When the server changes what
 * `materialize()` emits, apply that delta here.
 *
 * Which is the weakness worth naming: nothing enforces the shape agreement. The
 * server has no test that its output parses here and this repo cannot run the
 * server, so a new member added there is caught only by someone remembering. The
 * fix is a generator, not a stricter sentence in this comment.
 *
 * The pre-`basemapOverride` shape is asserted explicitly (`delete raw.basemapOverride`
 * below) rather than by leaving the fixture behind the server. That shape still
 * matters — it is every snapshot published before the field existed, and those are
 * served immutable for a year.
 */

import { describe, it, expect } from 'vitest';
import { parseEventMapManifest, parseEventMapSnapshot } from '../parser';
import { EVENTMAP_SCHEMA_VERSION } from '../../types/eventmap';
import snapshotFixture from './fixtures/eskara-snapshot.json';

/** Deep clone so a mutation in one test cannot leak into another. */
const fixture = () => JSON.parse(JSON.stringify(snapshotFixture)) as Record<string, unknown>;

const parse = (raw: unknown) => parseEventMapSnapshot(raw);

describe('parseEventMapSnapshot — real server output', () => {
  it('parses the materializer fixture without dropping anything', () => {
    const { snapshot, dropped } = parse(fixture());
    expect(snapshot).not.toBeNull();
    expect(dropped.reasons).toEqual([]);
    expect(dropped.items).toBe(0);
    expect(dropped.layers).toBe(0);
    expect(dropped.actions).toBe(0);
  });

  it('keeps every item, layer, chip group and icon', () => {
    const { snapshot } = parse(fixture());
    expect(snapshot!.items).toHaveLength(6);
    expect(snapshot!.layers).toHaveLength(5);
    expect(snapshot!.chipGroups).toHaveLength(4);
    expect(Object.keys(snapshot!.icons)).toHaveLength(12);
  });

  it('reads the basemapOverride the server now ships', () => {
    // ESKARA hides 건물번호 so pins stay legible, and leaves 건물이름
    // (`building_labels`) up for orientation.
    expect(parse(fixture()).snapshot!.basemapOverride).toEqual({ building_numbers: false });
  });

  it('defaults basemapOverride to {} when the field is absent', () => {
    // The shape of every snapshot published before the field existed. Those are
    // served `immutable, max-age=1y`, so they are still in caches and must not
    // be dropped whole for missing a member they could not have carried.
    const raw = fixture();
    delete raw.basemapOverride;
    expect(parse(raw).snapshot!.basemapOverride).toEqual({});
  });

  it('drops a non-boolean override value rather than coercing it', () => {
    const raw = { ...fixture(), basemapOverride: { building_numbers: false, junk: 'nope' } };
    // "nope" is not a visibility, and truthiness would silently force a layer ON
    // — revealing a layer the event meant to hide is the unrecoverable direction.
    expect(parse(raw).snapshot!.basemapOverride).toEqual({ building_numbers: false });
  });

  it('pins the fixture to the webview URL rule the server now enforces', () => {
    // This asserts about the fixture, NOT about the parser — worth being exact,
    // because the parser accepts any whitespace-free https URL and would happily
    // pass `https://…/#/eskara/entry` through. The real guard is server-side, in
    // toWebviewUrl; a fragment there resolves to `/` at HTTP 200, below the
    // webview's `statusCode >= 400` overlay, so the user lands on the wrong page
    // and nothing logs it. What this catches is the fixture drifting back.
    const { snapshot } = parse(fixture());
    const actions = snapshot!.items.flatMap((i) => i.actions);
    const webview = actions.filter((a) => a.actionType === 'webview');
    expect(webview.length).toBeGreaterThan(0);
    for (const a of webview) {
      expect(a.actionValue.startsWith('https://webview.skkuverse.com/')).toBe(true);
      expect(a.actionValue).not.toContain('#');
    }
  });

  it('preserves the null bounds the server uses to say "do not recompute"', () => {
    const { snapshot } = parse(fixture());
    const cancelled = snapshot!.items.find((i) => i.id === 'demo-rain-cancelled')!;
    expect(cancelled.status).toBe('closed');
    expect(cancelled.startAt).toBeNull();
    expect(cancelled.endAt).toBeNull();
  });

  it('carries the two-occupant stack through intact', () => {
    const { snapshot } = parse(fixture());
    const shared = snapshot!.items.filter((i) => i.stackKey === 'nsc-truck-01');
    expect(shared).toHaveLength(2);
  });

  it('ignores unknown top-level fields, since the schema is additive-only', () => {
    const raw = { ...fixture(), someFutureField: { a: 1 } };
    expect(parse(raw).snapshot).not.toBeNull();
  });
});

describe('parseEventMapSnapshot — refusals', () => {
  it('ignores a snapshot declaring a newer schema, leaving the base map alone', () => {
    const raw = { ...fixture(), schemaVersion: EVENTMAP_SCHEMA_VERSION + 1 };
    const { snapshot, dropped } = parse(raw);
    expect(snapshot).toBeNull();
    expect(dropped.reasons[0]).toContain('newer than this build');
  });

  it('returns null rather than throwing for a non-object payload', () => {
    expect(parse(null).snapshot).toBeNull();
    expect(parse('nope').snapshot).toBeNull();
    expect(parse(undefined).snapshot).toBeNull();
  });

  it('returns null when identity is missing, since nothing can be keyed on it', () => {
    expect(parse({ ...fixture(), id: undefined }).snapshot).toBeNull();
    expect(parse({ ...fixture(), version: undefined }).snapshot).toBeNull();
    expect(parse({ ...fixture(), campus: 'moon' }).snapshot).toBeNull();
  });
});

describe('parseEventMapSnapshot — per-entry drops', () => {
  const withItems = (items: unknown[]) => ({ ...fixture(), items });
  const item = (over: Record<string, unknown>) => ({
    ...(snapshotFixture as { items: Record<string, unknown>[] }).items[0],
    ...over,
  });

  it('drops an item with non-finite coordinates', () => {
    const { snapshot, dropped } = parse(withItems([item({ id: 'bad', lat: null })]));
    expect(snapshot!.items).toEqual([]);
    expect(dropped.items).toBe(1);
  });

  it('drops a [lng, lat]-swapped Seoul pair, which never throws on its own', () => {
    const { snapshot } = parse(withItems([item({ id: 'swapped', lat: 126.97, lng: 37.29 })]));
    expect(snapshot!.items).toEqual([]);
  });

  it('coerces an unknown status rather than dropping the item', () => {
    const { snapshot } = parse(withItems([item({ id: 'x', status: 'sideways' })]));
    expect(snapshot!.items[0]!.status).toBe('unknown');
  });

  it('falls stackKey back to placeId, keeping one marker per plot', () => {
    const { snapshot } = parse(withItems([item({ id: 'x', stackKey: undefined, placeId: 'p9' })]));
    expect(snapshot!.items[0]!.stackKey).toBe('p9');
  });

  it('drops a layer whose render it does not know', () => {
    const layers = [{ ...(snapshotFixture as { layers: unknown[] }).layers[0] as object, render: 'hologram' }];
    const { snapshot, dropped } = parse({ ...fixture(), layers });
    expect(snapshot!.layers).toEqual([]);
    expect(dropped.layers).toBe(1);
  });

  it('drops a layer whose filter cannot be trusted', () => {
    // A layer with an unusable filter would show everything or nothing; neither
    // is a safe guess, so the layer goes.
    const layers = [{ ...(snapshotFixture as { layers: unknown[] }).layers[0] as object, filter: ['not', ['bogus']] }];
    expect(parse({ ...fixture(), layers }).snapshot!.layers).toEqual([]);
  });

  it('drops a chip with an invalid predicate, and its group if nothing survives', () => {
    const chipGroups = [
      { id: 'g', label: null, selection: 'multi', chips: [{ id: 'c', label: 'C', predicate: ['bogus'] }] },
    ];
    const { snapshot, dropped } = parse({ ...fixture(), chipGroups });
    expect(snapshot!.chipGroups).toEqual([]);
    expect(dropped.chips).toBe(1);
    expect(dropped.chipGroups).toBe(1);
  });

  it('drops a sort whose key it cannot honour', () => {
    const { snapshot } = parse({ ...fixture(), sorts: [{ id: 's', label: 'S', by: 'distance' }] });
    expect(snapshot!.sorts).toEqual([]);
  });

  it('coerces an unknown icon kind to the library default', () => {
    const { snapshot } = parse({ ...fixture(), icons: { weird: { kind: 'lottie', src: 'x' } } });
    expect(snapshot!.icons.weird).toEqual({ kind: 'symbol', symbol: 'green' });
  });

  it('keeps a remote icon with its dimensions', () => {
    const icons = { pin: { kind: 'remote', uri: 'https://e.com/p.png', width: 32, height: 40 } };
    expect(parse({ ...fixture(), icons }).snapshot!.icons.pin).toEqual({
      kind: 'remote',
      uri: 'https://e.com/p.png',
      width: 32,
      height: 40,
    });
  });
});

describe('parseEventMapSnapshot — action validation', () => {
  const withActions = (actions: unknown[]) => {
    const base = (snapshotFixture as { items: Record<string, unknown>[] }).items[1]!;
    return { ...fixture(), items: [{ ...base, actions }] };
  };
  const got = (actions: unknown[]) => parse(withActions(actions)).snapshot!.items[0]!.actions;

  it('keeps the webview and external buttons ESKARA actually ships', () => {
    const { snapshot } = parse(fixture());
    const booth = snapshot!.items.find((i) => i.id === 'demo-daybooth-01')!;
    expect(booth.actions.map((a) => a.actionType)).toEqual(['webview', 'external']);
  });

  it('drops a relative actionValue, which is the shape of an open redirect', () => {
    expect(got([{ id: 'a', label: 'L', actionType: 'webview', actionValue: '/eskara' }])).toEqual([]);
  });

  it('drops a protocol-relative route, which escapes to another origin', () => {
    // `//evil.com/x` handed to a router is the same trick one layer down.
    expect(got([{ id: 'a', label: 'L', actionType: 'route', actionValue: '//evil.com/x' }])).toEqual([]);
  });

  it('keeps a well-formed internal route', () => {
    expect(got([{ id: 'a', label: 'L', actionType: 'route', actionValue: '/(tabs)/transit' }])).toHaveLength(1);
  });

  it('accepts any non-blank string for content, which is prose not a destination', () => {
    expect(got([{ id: 'a', label: 'L', actionType: 'content', actionValue: '18:00부터 입장' }])).toHaveLength(1);
  });

  it('drops an unknown action type instead of guessing at it', () => {
    expect(got([{ id: 'a', label: 'L', actionType: 'teleport', actionValue: 'https://x.com' }])).toEqual([]);
  });

  it('drops only the bad button, so the booth keeps its good ones', () => {
    const out = got([
      { id: 'ok', label: 'L', actionType: 'external', actionValue: 'https://skku.edu/' },
      { id: 'bad', label: 'L', actionType: 'external', actionValue: 'javascript:alert(1)' },
    ]);
    expect(out.map((a) => a.id)).toEqual(['ok']);
  });
});

describe('parseEventMapManifest', () => {
  const active = {
    schemaVersion: 1,
    activeLayerSetId: 'eskara-2026',
    version: 17,
    snapshotUrl: '/eventmap/snapshot/eskara-2026/17?lang=ko',
    refreshAfterSec: 60,
    nextChangeAt: '2026-09-16T11:00:00.000Z',
    publishedAt: '2026-09-15T23:40:11.000Z',
  };

  it('reads an active manifest', () => {
    expect(parseEventMapManifest(active)).toEqual(active);
  });

  it('reads an inactive manifest as no event', () => {
    const out = parseEventMapManifest({
      schemaVersion: 1,
      activeLayerSetId: null,
      version: null,
      snapshotUrl: null,
      refreshAfterSec: 300,
      nextChangeAt: null,
      publishedAt: null,
    });
    expect(out.activeLayerSetId).toBeNull();
    expect(out.refreshAfterSec).toBe(300);
  });

  it('treats a partial identity as no event, since nothing is fetchable', () => {
    // version without snapshotUrl describes nothing the client can request.
    expect(parseEventMapManifest({ ...active, snapshotUrl: null }).activeLayerSetId).toBeNull();
    expect(parseEventMapManifest({ ...active, version: null }).activeLayerSetId).toBeNull();
  });

  it('never throws — an unreadable manifest is indistinguishable from no event', () => {
    expect(parseEventMapManifest(null).activeLayerSetId).toBeNull();
    expect(parseEventMapManifest('garbage').activeLayerSetId).toBeNull();
    expect(parseEventMapManifest(undefined).refreshAfterSec).toBe(300);
  });
});
