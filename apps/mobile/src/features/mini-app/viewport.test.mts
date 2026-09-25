import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShellBar, ShellHeader } from '@skkuverse/miniapp/protocol';
import { computeViewport } from './viewport.ts';

// An iPhone with a Dynamic Island, portrait: 62 status bar, 34 home indicator,
// a 116 header (status bar included) and a 62 floating bar above the indicator.
const INSETS = { top: 62, bottom: 34, left: 0, right: 0 };
const BASE = { insets: INSETS, headerHeight: 116, bottomBarHeight: 62 };

const HEADERS: ShellHeader[] = ['opaque', 'overlay'];
const BARS: ShellBar[] = ['top', 'bottom', 'none'];

for (const header of HEADERS) {
  for (const bar of BARS) {
    for (const glassAvailable of [true, false]) {
      test(`header ${header} × bar ${bar} × ${glassAvailable ? 'glass' : 'no glass'}`, () => {
        const vp = computeViewport({ ...BASE, shell: { header, bar }, glassAvailable });

        // Top: under an opaque header the WebView starts below it, so nothing
        // covers its top edge. Under an overlay one it starts at y = 0.
        if (header === 'opaque') {
          assert.equal(vp.safeArea.top, 0);
          assert.equal(vp.contentSafeArea.top, 0);
        } else {
          assert.equal(vp.safeArea.top, 62);
          assert.equal(vp.contentSafeArea.top, 116 - 62);
        }

        // Bottom: the WebView always reaches the screen edge, so the home
        // indicator is always the page's to avoid. Only the floating bar adds.
        assert.equal(vp.safeArea.bottom, 34);
        assert.equal(vp.contentSafeArea.bottom, bar === 'bottom' ? 62 : 0);

        const drawnOver = header === 'overlay' || bar === 'bottom';
        assert.equal(vp.chrome, glassAvailable && drawnOver ? 'glass' : 'opaque');
      });
    }
  }
}

test('left and right come from the device insets (landscape), never the chrome', () => {
  const vp = computeViewport({
    ...BASE,
    insets: { top: 0, bottom: 21, left: 59, right: 59 },
    shell: { header: 'overlay', bar: 'bottom' },
    glassAvailable: true,
  });
  assert.deepEqual([vp.safeArea.left, vp.safeArea.right], [59, 59]);
  assert.deepEqual([vp.contentSafeArea.left, vp.contentSafeArea.right], [0, 0]);
});

test('never reports a negative or non-finite inset', () => {
  // Before the header lays out, useHeaderHeight can read below the status bar.
  const vp = computeViewport({
    shell: { header: 'overlay', bar: 'bottom' },
    insets: { top: 62, bottom: Number.NaN, left: -1, right: 0 },
    headerHeight: 0,
    bottomBarHeight: -5,
    glassAvailable: false,
  });
  assert.equal(vp.contentSafeArea.top, 0);
  assert.equal(vp.contentSafeArea.bottom, 0);
  assert.equal(vp.safeArea.bottom, 0);
  assert.equal(vp.safeArea.left, 0);
});

test('rounds fractional insets to whole CSS pixels', () => {
  const vp = computeViewport({
    shell: { header: 'overlay', bar: 'top' },
    insets: { top: 47.33, bottom: 34, left: 0, right: 0 },
    headerHeight: 91.67,
    bottomBarHeight: 0,
    glassAvailable: false,
  });
  assert.equal(vp.safeArea.top, 47);
  // What the page pads with, the sum, is the header's own rounded height.
  assert.equal(vp.safeArea.top + vp.contentSafeArea.top, 92);
});
