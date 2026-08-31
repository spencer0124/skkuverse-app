/**
 * The reversal that decides whether a zone can be tapped.
 *
 * The wire is wound per RFC 7946 §3.1.6 — exterior ring counter-clockwise,
 * every hole clockwise — and the server normalises it on the way out, so the
 * direction is a guarantee rather than a hope. `NaverMapPolygonOverlay`
 * documents the OPPOSITE and warns that a wrongly wound ring may "draw
 * abnormally or not receive events".
 *
 * That second half is what makes this file worth writing. A reversed ring often
 * still DRAWS, and simply refuses taps — so the bug ships looking correct, and
 * the only thing that reveals it is pressing a zone and having nothing happen.
 * A screenshot proves nothing here; an assertion does.
 *
 * Because the server's direction is a guarantee, the reversal is unconditional.
 * There is deliberately no shoelace test on the client: measuring a ring we
 * have been told the winding of would add an implementation that can disagree
 * with the one that produced the data.
 *
 * NOTE: apps/mobile runs `node --test` over `src/**\/*.test.mts`, a DIFFERENT
 * runner from packages/shared's vitest. `overlayGeometry.ts` imports only
 * TYPES, so `--experimental-strip-types` erases them and the module loads under
 * plain Node with no React or SDK dependency at runtime.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toNaverCoords, toPolygonGeometry, withAlpha } from './overlayGeometry.ts';

/** A closed square, wound counter-clockwise as the wire delivers it. */
const CCW_SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 10 },
  { lat: 10, lng: 0 },
  { lat: 0, lng: 0 },
];

describe('toNaverCoords — the rename, and nothing else', () => {
  it('renames lat and lng to the SDK spelling, in order', () => {
    assert.deepEqual(toNaverCoords([{ lat: 37.29, lng: 126.97 }]), [
      { latitude: 37.29, longitude: 126.97 },
    ]);
  });

  it('preserves sequence, which is the whole meaning of a line', () => {
    const out = toNaverCoords([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
    ]);
    assert.deepEqual(
      out.map((c) => c.latitude),
      [1, 2, 3],
    );
  });

  it('returns a fresh array, so a caller may reverse it in place', () => {
    const input = [{ lat: 1, lng: 1 }];
    const out = toNaverCoords(input);
    out.reverse();
    assert.equal(input.length, 1);
  });
});

describe('toPolygonGeometry — the unconditional reversal', () => {
  it('reverses the exterior ring, because the SDK wants the opposite winding', () => {
    const { coords } = toPolygonGeometry([CCW_SQUARE])!;
    assert.deepEqual(
      coords.map((c) => [c.latitude, c.longitude]),
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    );
  });

  it('leaves the ring closed after reversing it', () => {
    // A closed ring repeats its first position last, so reversal preserves
    // closure — but only because the duplicate was kept rather than trimmed at
    // the parser. If that ever changes this assertion fails first.
    const { coords } = toPolygonGeometry([CCW_SQUARE])!;
    assert.deepEqual(coords[0], coords[coords.length - 1]);
  });

  it('reverses holes too, which are wound the other way to begin with', () => {
    // Exterior CCW and holes CW on the wire; the SDK wants exterior CW and
    // holes CCW. One reversal serves both, which is why this is not two rules.
    const hole = [
      { lat: 2, lng: 2 },
      { lat: 2, lng: 4 },
      { lat: 4, lng: 4 },
      { lat: 2, lng: 2 },
    ];
    const { holes } = toPolygonGeometry([CCW_SQUARE, hole])!;
    assert.equal(holes.length, 1);
    assert.deepEqual(holes[0]!.map((c) => [c.latitude, c.longitude]), [
      [2, 2],
      [4, 4],
      [2, 4],
      [2, 2],
    ]);
  });

  it('takes rings[0] as the exterior and everything after it as holes', () => {
    const hole = [
      { lat: 2, lng: 2 },
      { lat: 2, lng: 4 },
      { lat: 4, lng: 4 },
      { lat: 2, lng: 2 },
    ];
    const { coords, holes } = toPolygonGeometry([CCW_SQUARE, hole, hole])!;
    assert.equal(coords.length, CCW_SQUARE.length);
    assert.equal(holes.length, 2);
  });

  it('gives a solid zone an empty holes list rather than undefined', () => {
    assert.deepEqual(toPolygonGeometry([CCW_SQUARE])!.holes, []);
  });

  it('answers null for a polygon with no rings, rather than drawing nothing quietly', () => {
    // Unreachable from the parser, which drops such an overlay. Null keeps the
    // component's "nothing to draw" branch explicit instead of handing the SDK
    // an empty coords array it documents as un-addable.
    assert.equal(toPolygonGeometry([]), null);
  });
});

describe('withAlpha — the fill the SDK would otherwise paint opaque black', () => {
  it('composes a six-digit hex and an opacity into eight digits', () => {
    assert.equal(withAlpha('#3182F6', 0.5), '#3182F680');
  });

  it('reads 1 as fully opaque and 0 as fully transparent', () => {
    assert.equal(withAlpha('#3182F6', 1), '#3182F6ff');
    assert.equal(withAlpha('#3182F6', 0), '#3182F600');
  });

  it('carries the festival opacities the server actually sends', () => {
    // 0.18 on a festival zone, 0.12 on campus geometry. Real values, so the
    // rounding is exercised where it will actually be used.
    assert.equal(withAlpha('#F04452', 0.18), '#F044522e');
    assert.equal(withAlpha('#F04452', 0.12), '#F044521f');
  });

  it('expands a three-digit hex before appending the alpha', () => {
    assert.equal(withAlpha('#abc', 0.5), '#aabbcc80');
  });

  it('leaves the colour alone when no opacity was sent', () => {
    // Absent means the server said nothing, and a layer with no fill opacity is
    // a layer that wants the colour as-is — never a silent 100%.
    assert.equal(withAlpha('#3182F6', undefined), '#3182F6');
  });

  it('leaves a colour it cannot decompose alone rather than mangling it', () => {
    // `toCssColor` passes named colours and already-alpha'd hex through, and
    // producing `rgba(NaN,NaN,NaN,1)` from one of those is exactly the bug the
    // deleted `hexToRgba` shipped.
    assert.equal(withAlpha('transparent', 0.5), 'transparent');
    assert.equal(withAlpha('#3182F680', 0.5), '#3182F680');
  });

  it('clamps an out-of-range opacity instead of emitting a bad byte', () => {
    assert.equal(withAlpha('#3182F6', 2), '#3182F6ff');
    assert.equal(withAlpha('#3182F6', -1), '#3182F600');
    assert.equal(withAlpha('#3182F6', NaN), '#3182F6');
  });
});
