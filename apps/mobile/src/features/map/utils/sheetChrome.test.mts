/**
 * Sheet chrome interpolation.
 *
 * Three values travel together as the campus sheet is dragged — the card's gap
 * from the screen edges, its corner radius, and how opaque it is — and the
 * awkward cases are all at the ends of the range rather than in the middle.
 *
 * NOTE: apps/mobile runs `node --test`, a different runner from packages/shared's
 * vitest. `sheetChrome.ts` imports nothing at all, so it loads under plain Node.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sheetChromeAt,
  SHEET_FLOAT_INSET,
  SHEET_RADIUS_FLOATING,
  SHEET_RADIUS_ATTACHED,
  DISPLAY_CORNER_RADIUS,
} from './sheetChrome.ts';

/** The campus sheet's three detents: 30% / 50% / 85%. */
const LAST = 2;

describe('sheetChromeAt', () => {
  it('floats fully at the collapsed detent', () => {
    assert.deepEqual(sheetChromeAt(0, LAST), {
      inset: SHEET_FLOAT_INSET,
      radius: SHEET_RADIUS_FLOATING,
      bottomRadius: DISPLAY_CORNER_RADIUS - SHEET_FLOAT_INSET,
      fillOpacity: 0,
    });
  });

  it('is exactly the attached sheet at the top detent', () => {
    assert.deepEqual(sheetChromeAt(LAST, LAST), {
      inset: 0,
      radius: SHEET_RADIUS_ATTACHED,
      bottomRadius: DISPLAY_CORNER_RADIUS,
      fillOpacity: 1,
    });
  });

  it('half-closes its gaps at the middle detent but stays pure glass', () => {
    const mid = sheetChromeAt(1, LAST);
    assert.equal(mid.inset, SHEET_FLOAT_INSET / 2);
    assert.equal(mid.radius, (SHEET_RADIUS_FLOATING + SHEET_RADIUS_ATTACHED) / 2);
    // The whole point of ramping the fill over the final segment only.
    assert.equal(mid.fillOpacity, 0);
  });

  it('keeps the glass clear across the entire first half of the travel', () => {
    for (const index of [0, 0.25, 0.5, 0.75, 1]) {
      assert.equal(
        sheetChromeAt(index, LAST).fillOpacity,
        0,
        `fill should still be clear at index ${index}`,
      );
    }
  });

  it('dissolves the glass evenly across the final segment', () => {
    assert.equal(sheetChromeAt(1.5, LAST).fillOpacity, 0.5);
    assert.equal(sheetChromeAt(1.25, LAST).fillOpacity, 0.25);
  });

  it('keeps the bottom corners concentric with the display at every detent', () => {
    // The rule that makes them stay inside the screen's own rounding: a rect
    // inset by i needs a corner of at least R - i, or the OS mask slices it.
    for (const index of [0, 0.5, 1, 1.5, 2]) {
      const c = sheetChromeAt(index, LAST);
      assert.ok(
        c.bottomRadius >= DISPLAY_CORNER_RADIUS - c.inset - 1e-9,
        `index ${index}: bottom ${c.bottomRadius} would be cut at inset ${c.inset}`,
      );
      assert.ok(c.bottomRadius >= c.radius, 'bottom is never tighter than the top');
    }
  });

  it('holds the floating card through a downward over-drag', () => {
    // animatedIndex dips below 0 when the sheet is over-dragged past its lowest
    // detent. The card is on screen and under the finger, so it must not snap
    // to the opaque attached geometry.
    assert.deepEqual(sheetChromeAt(-0.3, LAST), sheetChromeAt(0, LAST));
  });

  it('clamps a closed sheet to the same floating card', () => {
    assert.deepEqual(sheetChromeAt(-1, LAST), sheetChromeAt(0, LAST));
  });

  it('never overshoots above the top detent', () => {
    assert.deepEqual(sheetChromeAt(LAST + 0.4, LAST), sheetChromeAt(LAST, LAST));
  });

  it('degrades a single-detent sheet to the plain attached sheet', () => {
    assert.deepEqual(sheetChromeAt(0, 0), {
      inset: 0,
      radius: SHEET_RADIUS_ATTACHED,
      bottomRadius: DISPLAY_CORNER_RADIUS,
      fillOpacity: 1,
    });
  });

  it('moves its endpoint with the detent count', () => {
    // A fourth detent must make index 3 the attached one, not index 2.
    assert.equal(sheetChromeAt(3, 3).inset, 0);
    assert.equal(sheetChromeAt(3, 3).fillOpacity, 1);
    assert.equal(sheetChromeAt(2, 3).fillOpacity, 0);
  });
});
