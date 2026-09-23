/**
 * The place sheet's collapsed height.
 *
 * The rule that matters is that the DEFAULT detent wins for anything with a
 * real body — it is the mid-size card, and sizing the sheet to less than that
 * makes every place a sliver. Only a sheet shorter than the detent shrinks.
 *
 * NOTE: apps/mobile runs `node --test`; `sheetFold.ts` imports nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collapsedDetentHeight, detentHeight } from './sheetFold.ts';

// An iPhone 15-sized window, the `small` detent, the campus card's gap, and a
// 22pt handle over a 40pt header.
const BASE = { containerHeight: 852, detentPercent: 45, bottomGap: 90, chromeAbove: 62 };

describe('detentHeight', () => {
  it('resolves the percentage against the container', () => {
    assert.equal(detentHeight(1000, 45), 450);
  });
});

describe('collapsedDetentHeight', () => {
  it('waits for a measurement', () => {
    assert.equal(collapsedDetentHeight({ ...BASE, contentHeight: null }), null);
    assert.equal(collapsedDetentHeight({ ...BASE, contentHeight: 0 }), null);
  });

  // 852 * 0.45 = 383.4 → 383. A place with a facts card and a body is well past
  // that, so it gets the mid-size card the sheet has always had.
  it('keeps the default mid-size detent for a place with a body', () => {
    assert.equal(collapsedDetentHeight({ ...BASE, contentHeight: 900 }), 383);
    assert.equal(collapsedDetentHeight({ ...BASE, contentHeight: 400 }), 383);
  });

  it('shrinks only when the whole sheet is shorter than the detent', () => {
    // 62 chrome + 180 content = 242, under the 383 detent.
    assert.equal(collapsedDetentHeight({ ...BASE, contentHeight: 180 }), 242);
  });

  // `contentHeight` already carries the scroll view's bottom padding, which is
  // what pays for the gap the card floats above the screen. Adding `bottomGap`
  // here again would push a short sheet past its own content.
  it('does not add the floating gap a second time', () => {
    const wide = collapsedDetentHeight({ ...BASE, contentHeight: 180 });
    const noGap = collapsedDetentHeight({ ...BASE, bottomGap: 0, contentHeight: 180 });
    assert.equal(wide, noGap);
  });

  it('rounds up, so a fractional content height is never cut', () => {
    assert.equal(collapsedDetentHeight({ ...BASE, contentHeight: 180.2 }), 243);
  });
});
