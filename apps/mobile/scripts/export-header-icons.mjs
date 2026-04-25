#!/usr/bin/env node
/**
 * Exports Phosphor SVGs to PNG assets for native Stack header bar buttons.
 *
 * Why PNG (not phosphor JSX):
 *   `unstable_headerRightItems` registers each item as a real UIBarButtonItem,
 *   which on iOS 26 lets each icon get its own Liquid Glass capsule (vs a single
 *   View in `headerRight` collapsing into one capsule). The native API only
 *   accepts SF Symbol or `ImageSourcePropType`, so we bake phosphor SVGs into
 *   tinted PNGs at @1x/2x/3x.
 *
 * Run from any cwd — paths resolve relative to this file:
 *   node apps/mobile/scripts/export-header-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PHOSPHOR_ASSETS = resolve(REPO_ROOT, 'node_modules/@phosphor-icons/core/assets');
const OUT_DIR = resolve(__dirname, '../assets/header-icons');

// Color values mirror SdsColors in packages/shared/src/tokens/colors.ts.
const GREY_700 = '#4E5968';
const GREY_500 = '#8B95A1';

const ICONS = [
  // magnifying-glass / bookmark-simple / bell / bell-slash: icons rendered as
  // native UIBarButtonItem images (`type: 'button'`) in the notices header.
  // PNG (not phosphor JSX) is required because `unstable_headerRightItems` on
  // iOS routes button icons through `headerRightBarButtonItems` native prop
  // which only accepts ImageSource or SF Symbol. Phosphor's color baked at
  // export time so `tinted: false` preserves SDS color tokens (vs being
  // re-tinted by navbar tintColor).
  { name: 'magnifying-glass', phosphor: 'magnifying-glass', color: GREY_700 },
  { name: 'bookmark-simple', phosphor: 'bookmark-simple', color: GREY_700 },
  { name: 'bell', phosphor: 'bell', color: GREY_700 },
  { name: 'bell-slash', phosphor: 'bell-slash', color: GREY_500 },
  // caret-left: chevron used by `headerBackImageSource` to replace iOS system
  // back image while letting UINavigationController keep auto show/hide and
  // edge-swipe gesture.
  { name: 'caret-left', phosphor: 'caret-left', color: GREY_700 },
];

const BASE_SIZE = 22;

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const { name, phosphor, color } of ICONS) {
  const svgPath = resolve(PHOSPHOR_ASSETS, 'regular', `${phosphor}.svg`);
  const rawSvg = readFileSync(svgPath, 'utf-8');
  const tinted = rawSvg.replaceAll('currentColor', color);

  for (const scale of [1, 2, 3]) {
    const size = BASE_SIZE * scale;
    const densitySuffix = scale === 1 ? '' : `@${scale}x`;
    const outName = `${name}${densitySuffix}.png`;
    const outPath = resolve(OUT_DIR, outName);

    const resvg = new Resvg(tinted, {
      fitTo: { mode: 'width', value: size },
      background: 'rgba(0,0,0,0)',
    });
    writeFileSync(outPath, resvg.render().asPng());
    console.log(`  ${outName}  (${size}×${size})`);
    count++;
  }
}

console.log(`\n✅ Exported ${count} header-icon PNG files to ${OUT_DIR}`);
