/**
 * The marker shape axis: what a place marker draws, and where it hangs.
 *
 * NOTE: apps/mobile runs `node --test` over `src/**\/*.test.mts`, a DIFFERENT
 * runner from packages/shared's vitest. `markerShape.ts` imports only a type
 * from @skkuverse/shared, so `--experimental-strip-types` erases it and the
 * module loads under plain Node with no React or SDK dependency.
 *
 * The anchor is the half most easily got wrong, and it is why geometry is
 * resolved here rather than inline in the render loop: a teardrop hangs by its
 * tip and a disc by its centre, so swapping the image without swapping the
 * anchor slides the marker off the coordinate it is meant to be marking.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOT_CANVAS_RATIO,
  DOT_DIAMETER,
  PIN_HEIGHT,
  PIN_WIDTH,
  resolveMarkerGeometry,
} from './markerShape.ts';

const LIVE = { width: 22, height: 30, captionTextSize: 9 };

describe('resolveMarkerGeometry — the default is dotThenPin', () => {
  it('draws a dot when nothing is selected and the server said nothing', () => {
    assert.equal(resolveMarkerGeometry(undefined, false, undefined).kind, 'dot');
  });

  it('draws a pin for the selected marker', () => {
    assert.equal(resolveMarkerGeometry(undefined, true, undefined).kind, 'pin');
  });

  it('treats an explicit dotThenPin the same as an absent shape', () => {
    for (const selected of [true, false]) {
      assert.deepEqual(
        resolveMarkerGeometry('dotThenPin', selected, LIVE),
        resolveMarkerGeometry(undefined, selected, LIVE),
      );
    }
  });
});

describe('resolveMarkerGeometry — pin and dot are unconditional', () => {
  it('keeps a pin layer a pin either way', () => {
    assert.equal(resolveMarkerGeometry('pin', false, LIVE).kind, 'pin');
    assert.equal(resolveMarkerGeometry('pin', true, LIVE).kind, 'pin');
  });

  it('keeps a dot layer a dot either way', () => {
    assert.equal(resolveMarkerGeometry('dot', false, LIVE).kind, 'dot');
    assert.equal(resolveMarkerGeometry('dot', true, LIVE).kind, 'dot');
  });
});

describe('resolveMarkerGeometry — the anchor follows the shape', () => {
  it('hangs a teardrop by its tip', () => {
    assert.equal(resolveMarkerGeometry('pin', false, LIVE).anchorY, 1);
  });

  it('hangs a disc by its centre', () => {
    assert.equal(resolveMarkerGeometry('dot', false, LIVE).anchorY, 0.5);
  });

  it('moves the anchor with the shape across a selection, not just the image', () => {
    const before = resolveMarkerGeometry('dotThenPin', false, LIVE);
    const after = resolveMarkerGeometry('dotThenPin', true, LIVE);
    assert.equal(before.anchorY, 0.5);
    assert.equal(after.anchorY, 1);
  });
});

describe('resolveMarkerGeometry — geometry comes off the wire, with the old constants as fallbacks', () => {
  it('sizes a pin from style.width/height', () => {
    const g = resolveMarkerGeometry('pin', false, { width: 40, height: 55 });
    assert.deepEqual([g.width, g.height], [40, 55]);
  });

  it('falls a pin back to the constants this file used to hardcode', () => {
    const g = resolveMarkerGeometry('pin', false, undefined);
    assert.deepEqual([g.width, g.height], [PIN_WIDTH, PIN_HEIGHT]);
  });

  it('pads the dot canvas so the tap target is bigger than the visible disc', () => {
    // The asset carries transparent padding; `size` names the VISIBLE diameter,
    // so the overlay has to be told the padded canvas or the disc renders small
    // inside a box that was never grown.
    const g = resolveMarkerGeometry('dot', false, { size: 18 });
    assert.equal(g.width, 18 * DOT_CANVAS_RATIO);
    assert.equal(g.width, g.height);
    assert.ok(g.width > 18, 'the canvas must exceed the visible disc');
  });

  it('falls the dot back to DOT_DIAMETER when the server sends no size', () => {
    const g = resolveMarkerGeometry('dot', false, LIVE);
    assert.equal(g.width, DOT_DIAMETER * DOT_CANVAS_RATIO);
  });

  it('grows a selected dot to the pin width, so one wire field sizes both shapes', () => {
    const g = resolveMarkerGeometry('dot', true, LIVE);
    assert.equal(g.width, LIVE.width * DOT_CANVAS_RATIO);
  });
});

describe('resolveMarkerGeometry — a selected marker is visibly bigger than an unselected one', () => {
  it('holds for dotThenPin', () => {
    const dot = resolveMarkerGeometry('dotThenPin', false, LIVE);
    const pin = resolveMarkerGeometry('dotThenPin', true, LIVE);
    // Compare the VISIBLE disc, not the padded canvas — the padding is a tap
    // target, not something the eye reads as size.
    assert.ok(dot.width / DOT_CANVAS_RATIO < pin.width);
  });

  it('holds for dot', () => {
    assert.ok(
      resolveMarkerGeometry('dot', false, LIVE).width <
        resolveMarkerGeometry('dot', true, LIVE).width,
    );
  });
});
