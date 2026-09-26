import libraryDay from '../../assets/skyline/samsung-library-day.png';
import libraryNight from '../../assets/skyline/samsung-library-night.png';
import myeongDay from '../../assets/skyline/myeongnyundang-day.png';
import myeongNight from '../../assets/skyline/myeongnyundang-night.png';
import { PX } from '../sprites';
import type { Layout } from './layout';

/**
 * The campus on the far horizon, behind the festival booths: 삼성학술정보관 from
 * 자과캠 and 명륜당 from 인사캠, the two campuses the festival joins. Each is a
 * day/night pair of PNGs (made by scripts/skyline-art.mjs, replaceable by hand)
 * crossfaded as night falls.
 */
export const SKYLINE_ART = [
  { day: libraryDay, night: libraryNight, x: 20 },
  { day: myeongDay, night: myeongNight, x: 380 },
] as const;

/** Logical width of one repeat of the far layer. */
const TILE = 780;
/** The far layer scrolls at this fraction of the track. */
const PARALLAX = 0.1;

interface Loaded {
  day: HTMLImageElement;
  night: HTMLImageElement;
  x: number;
}

function load(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

let images: Loaded[] | null = null;

function ready(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

export function drawLandmarks(ctx: CanvasRenderingContext2D, L: Layout, night: number, scroll: number): void {
  images ??= SKYLINE_ART.map((a) => ({ day: load(a.day), night: load(a.night), x: a.x }));
  const u = L.scale * PX;
  const tile = TILE * L.scale;
  const offset = ((scroll * L.scale * PARALLAX) % tile + tile) % tile;

  for (let x0 = -offset; x0 < L.w; x0 += tile) {
    for (const a of images) {
      // Until both halves of a pair have loaded, draw neither: a building
      // popping between day and night looks worse than one arriving late.
      if (!ready(a.day) || !ready(a.night)) continue;
      const w = a.day.naturalWidth * u;
      const h = a.day.naturalHeight * u;
      const x = Math.round(x0 + a.x * L.scale);
      if (x > L.w || x + w < 0) continue;
      const y = Math.round(L.groundY - h);
      if (night < 1) {
        ctx.globalAlpha = 1 - night;
        ctx.drawImage(a.day, x, y, w, h);
      }
      if (night > 0) {
        ctx.globalAlpha = night;
        ctx.drawImage(a.night, x, y, w, h);
      }
    }
  }
  ctx.globalAlpha = 1;
}
