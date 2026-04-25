#!/usr/bin/env node
/**
 * Exports Phosphor SVGs to PNG assets for iOS NativeTabs.
 *
 * Phosphor ships outline (regular) + filled (fill) variants natively as
 * separate SVG files designed by hand — no string manipulation needed.
 * iOS NativeTabs Icon `src={{ default, selected }}` maps to these two PNGs.
 *
 * Colors are baked at export time (inactive = gray, active = dark) so the
 * visual is correct regardless of how iOS UITabBarItem rendering mode treats
 * the asset (template tint vs original).
 *
 * Run from any cwd — paths resolve relative to this file:
 *   node apps/mobile/scripts/export-tab-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PHOSPHOR_ASSETS = resolve(REPO_ROOT, 'node_modules/@phosphor-icons/core/assets');
const OUT_DIR = resolve(__dirname, '../assets/tab-icons');

// Tab name (route) → Phosphor source name (filename minus extension)
const ICONS = [
  { tab: 'home', phosphor: 'house' },
  { tab: 'bell', phosphor: 'bell' },
  { tab: 'map', phosphor: 'map-trifold' },
  { tab: 'navigation', phosphor: 'navigation-arrow' },
];

const BASE_SIZE = 22;
const COLOR_INACTIVE = '#B0B8C1';
const COLOR_ACTIVE = '#191F28';

mkdirSync(OUT_DIR, { recursive: true });

const VARIANTS = [
  { suffix: '-outline', dir: 'regular', filenameSuffix: '', color: COLOR_INACTIVE },
  { suffix: '-filled', dir: 'fill', filenameSuffix: '-fill', color: COLOR_ACTIVE },
];

let count = 0;
for (const { tab, phosphor } of ICONS) {
  for (const variant of VARIANTS) {
    const svgPath = resolve(
      PHOSPHOR_ASSETS,
      variant.dir,
      `${phosphor}${variant.filenameSuffix}.svg`,
    );
    const rawSvg = readFileSync(svgPath, 'utf-8');
    const tinted = rawSvg.replaceAll('currentColor', variant.color);

    for (const scale of [1, 2, 3]) {
      const size = BASE_SIZE * scale;
      const densitySuffix = scale === 1 ? '' : `@${scale}x`;
      const outName = `${tab}${variant.suffix}${densitySuffix}.png`;
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
}

console.log(`\n✅ Exported ${count} Phosphor PNG files to ${OUT_DIR}`);
