import { VIEW_HEIGHT, VIEW_WIDTH } from '../constants';

/** Where the world sits on the screen, in CSS pixels. */
export interface Layout {
  w: number;
  h: number;
  dpr: number;
  /** CSS px per logical px. */
  scale: number;
  /** Screen y of the ground line. */
  groundY: number;
  /** Screen x of the world's left edge (non-zero when the height limits scale). */
  worldLeft: number;
  /** Size of one art pixel on screen, for background pixel work. */
  pixel: number;
}

/**
 * The ground sits a little above the middle, so the sky over the playfield has
 * room for the title and the field below stays clear of the mini-app shell's
 * bottom bar, which overlays the page by about 66 px.
 */
export const GROUND_RATIO = 0.58;

export function computeLayout(w: number, h: number, dpr: number): Layout {
  const groundY = Math.round(h * GROUND_RATIO);
  const scale = Math.min(w / VIEW_WIDTH, groundY / (VIEW_HEIGHT * 2));
  return {
    w,
    h,
    dpr,
    scale,
    groundY,
    worldLeft: Math.round((w - VIEW_WIDTH * scale) / 2),
    pixel: Math.max(2, Math.round(2 * scale)),
  };
}

/** Snap a CSS coordinate to the device pixel grid so pixel art stays crisp. */
export function snap(v: number, dpr: number): number {
  return Math.round(v * dpr) / dpr;
}
