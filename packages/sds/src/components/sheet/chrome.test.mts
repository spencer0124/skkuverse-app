/**
 * Sheet chrome interpolation.
 *
 * Four values travel together as a glass sheet is dragged — how far along the
 * travel it is, the card's gap from the screen edges, its corner radius, and
 * how opaque it is — and the awkward cases are all at the ends of the range
 * rather than in the middle.
 *
 * NOTE: packages/sds runs `node --test`, a different runner from packages/shared's
 * vitest. `chrome.ts` imports nothing at all, so it loads under plain Node.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sheetChromeAt,
  bottomCornerRadius,
  SHEET_FLOAT_INSET,
  SHEET_RADIUS_FLOATING,
  SHEET_RADIUS_ATTACHED,
  DISPLAY_CORNER_RADIUS,
} from './chrome.ts';

/** A three-detent sheet, the campus sheet's shape. */
const LAST = 2;

describe('sheetChromeAt', () => {
  it('floats fully at the collapsed detent', () => {
    assert.deepEqual(sheetChromeAt(0, LAST), {
      progress: 0,
      sideInset: SHEET_FLOAT_INSET,
      radius: SHEET_RADIUS_FLOATING,
      fillOpacity: 0,
    });
  });

  it('is exactly the attached sheet at the top detent', () => {
    assert.deepEqual(sheetChromeAt(LAST, LAST), {
      progress: 1,
      sideInset: 0,
      radius: SHEET_RADIUS_ATTACHED,
      fillOpacity: 1,
    });
  });

  it('half-closes its gaps at the middle detent but stays pure glass', () => {
    const mid = sheetChromeAt(1, LAST);
    assert.equal(mid.progress, 0.5);
    assert.equal(mid.sideInset, SHEET_FLOAT_INSET / 2);
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
      progress: 1,
      sideInset: 0,
      radius: SHEET_RADIUS_ATTACHED,
      fillOpacity: 1,
    });
  });

  it('moves its endpoint with the detent count', () => {
    // A fourth detent must make index 3 the attached one, not index 2.
    assert.equal(sheetChromeAt(3, 3).sideInset, 0);
    assert.equal(sheetChromeAt(3, 3).fillOpacity, 1);
    assert.equal(sheetChromeAt(2, 3).fillOpacity, 0);
  });

  it('ramps `progress` so a caller can close a gap it alone knows', () => {
    // A modal's bottom gap is measured from the window, not from the screen's
    // root view, so it cannot come out of this function — the caller scales its
    // own float-state gap by (1 - progress) and lands on the same schedule.
    const modalFloatGap = 96;
    assert.equal(modalFloatGap * (1 - sheetChromeAt(0, LAST).progress), modalFloatGap);
    assert.equal(modalFloatGap * (1 - sheetChromeAt(1, LAST).progress), modalFloatGap / 2);
    assert.equal(modalFloatGap * (1 - sheetChromeAt(LAST, LAST).progress), 0);
  });
});

describe('bottomCornerRadius', () => {
  it('keeps the bottom corners concentric with the display at every detent', () => {
    // The rule that makes them stay inside the screen's own rounding: a rect
    // inset by i needs a corner of at least R - i, or the OS mask slices it.
    for (const index of [0, 0.5, 1, 1.5, 2]) {
      const c = sheetChromeAt(index, LAST);
      const bottomGap = SHEET_FLOAT_INSET * (1 - c.progress);
      const bottom = bottomCornerRadius(c.radius, bottomGap);
      assert.ok(
        bottom >= DISPLAY_CORNER_RADIUS - bottomGap - 1e-9,
        `index ${index}: bottom ${bottom} would be cut at gap ${bottomGap}`,
      );
      assert.ok(bottom >= c.radius, 'bottom is never tighter than the top');
    }
  });

  it('is the display radius once the gap has closed', () => {
    assert.equal(bottomCornerRadius(SHEET_RADIUS_ATTACHED, 0), DISPLAY_CORNER_RADIUS);
  });

  it('never returns tighter than the top radius, however large the gap', () => {
    // A modal card sitting a long way off the bottom of the window: the
    // concentric rule would ask for a corner smaller than the design value.
    assert.equal(bottomCornerRadius(SHEET_RADIUS_FLOATING, 200), SHEET_RADIUS_FLOATING);
  });
});
