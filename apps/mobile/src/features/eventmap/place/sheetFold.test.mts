/**
 * The place sheet's fold.
 *
 * The collapsed card must show the summary and never the tab bar, and a place
 * with nothing below its summary must not float a card of empty glass. Both
 * reduce to arithmetic on the detent, and the edges worth pinning are the ones
 * that would draw a broken layout rather than a slightly wrong one: negative
 * heights, and a fitted sheet taller than the default.
 *
 * NOTE: apps/mobile runs `node --test`; `sheetFold.ts` imports nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collapsedContentHeight, detentHeight, fittedDetentHeight } from './sheetFold.ts';

// An iPhone 15-sized window, the `small` detent, the campus card's gap, and a
// 22pt handle over a 40pt header.
const BASE = { containerHeight: 852, detentPercent: 45, bottomGap: 90, chromeAbove: 62 };

describe('detentHeight', () => {
  it('resolves the percentage against the container', () => {
    assert.equal(detentHeight(1000, 45), 450);
  });
});

describe('collapsedContentHeight', () => {
  it('is the detent less the floating gap and the chrome', () => {
    // 852 * 0.45 = 383.4 → 383.4 - 90 - 62 = 231.4 → 231
    assert.equal(collapsedContentHeight(BASE), 231);
  });

  it('never goes negative', () => {
    assert.equal(collapsedContentHeight({ ...BASE, containerHeight: 200 }), 0);
  });
});

describe('fittedDetentHeight', () => {
  it('waits for a measurement', () => {
    assert.equal(fittedDetentHeight({ ...BASE, contentHeight: null }), null);
    assert.equal(fittedDetentHeight({ ...BASE, contentHeight: 0 }), null);
  });

  it('hugs a short summary', () => {
    assert.equal(fittedDetentHeight({ ...BASE, contentHeight: 180.2 }), 243);
  });

  it('never grows past the default detent', () => {
    assert.equal(fittedDetentHeight({ ...BASE, contentHeight: 900 }), 383);
  });
});
