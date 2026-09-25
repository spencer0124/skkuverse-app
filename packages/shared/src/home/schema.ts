/**
 * Home layout — client-side wire types + tolerant parser for `GET /ui/home`.
 *
 * The layout is SERVER-OWNED (skkuverse-server `src/ui/home/`); keep these types
 * in step with its `home-layout.types.ts`. The server validates its own file at
 * boot and fails loud; this side renders an untrusted payload and fails soft —
 * an unknown section type, an unknown banner item type or a broken item costs
 * that one block, never the screen. That is what lets the server add a section
 * type that already-released builds simply skip.
 *
 * Mini-app grids carry ids only. Names and logos are joined from the mini-app
 * registry (`useMiniAppIndex`), which the home screen already holds.
 */
import { parseActionType, type ActionType } from '../types/sdui';

/** Bump only on BREAKING schema changes (removed/renamed/retyped field). */
export const HOME_LAYOUT_VERSION = 1;

/** The slot's shape when the server sends none, or one out of range. */
export const DEFAULT_BANNER_ASPECT_RATIO = 2.25;
/** Seconds per page when the server sends none, or one out of range. */
export const DEFAULT_AUTO_ROTATE_SEC = 5;

// Same ranges the server validates against. Out-of-range values fall back to
// the defaults above rather than being clamped: a value this far off is a bug,
// and a clamped one would look deliberate.
const ASPECT_RATIO_MIN = 1;
const ASPECT_RATIO_MAX = 6;
const AUTO_ROTATE_SEC_MIN = 2;
const AUTO_ROTATE_SEC_MAX = 30;

const HTTPS_RE = /^https:\/\//;

export interface HomeBannerImage {
  type: 'image';
  id: string;
  imageUrl: string;
  alt: string;
  /** Absent when the banner does nothing on tap. */
  action?: { actionType: ActionType; actionValue: string };
}

/** The app's built-in banner, placed where the server put it in the rotation. */
export interface HomeBannerDefault {
  type: 'default';
}

export type HomeBannerItem = HomeBannerImage | HomeBannerDefault;

export interface HomeBannerCarousel {
  type: 'banner_carousel';
  id: string;
  aspectRatio: number;
  /** 0 = no auto-rotation. */
  autoRotateSec: number;
  items: HomeBannerItem[];
}

export interface HomeMiniAppGrid {
  type: 'miniapp_grid';
  id: string;
  title?: string;
  miniAppIds: string[];
}

export type HomeSection = HomeBannerCarousel | HomeMiniAppGrid;

export interface HomeLayout {
  version: number;
  sections: HomeSection[];
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function parseAutoRotateSec(v: unknown): number {
  if (v === 0) return 0;
  return inRange(v, AUTO_ROTATE_SEC_MIN, AUTO_ROTATE_SEC_MAX) ? v : DEFAULT_AUTO_ROTATE_SEC;
}

function parseBannerItem(raw: unknown): HomeBannerItem | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  if (obj.type === 'default') return { type: 'default' };
  if (obj.type !== 'image') return null;

  const id = asString(obj.id);
  const imageUrl = asString(obj.imageUrl);
  if (!id || !imageUrl || !HTTPS_RE.test(imageUrl)) return null;

  const item: HomeBannerImage = {
    type: 'image',
    id,
    imageUrl,
    // Never blank for a screen reader: fall back to the id rather than nothing.
    alt: asString(obj.alt) ?? id,
  };
  const actionType = parseActionType(obj.actionType);
  const actionValue = asString(obj.actionValue);
  // An action this build cannot interpret makes the banner inert, not hidden:
  // the picture is still worth showing.
  if (actionType !== 'unknown' && actionValue) {
    item.action = { actionType, actionValue };
  }
  return item;
}

function parseSection(raw: unknown): HomeSection | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  if (!obj || !id) return null;

  if (obj.type === 'banner_carousel') {
    const items = Array.isArray(obj.items)
      ? obj.items.map(parseBannerItem).filter((i): i is HomeBannerItem => i !== null)
      : [];
    return {
      type: 'banner_carousel',
      id,
      aspectRatio: inRange(obj.aspectRatio, ASPECT_RATIO_MIN, ASPECT_RATIO_MAX)
        ? obj.aspectRatio
        : DEFAULT_BANNER_ASPECT_RATIO,
      autoRotateSec: parseAutoRotateSec(obj.autoRotateSec),
      items,
    };
  }

  if (obj.type === 'miniapp_grid') {
    const miniAppIds = Array.isArray(obj.miniAppIds)
      ? obj.miniAppIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    if (miniAppIds.length === 0) return null;
    const title = asString(obj.title);
    return { type: 'miniapp_grid', id, ...(title ? { title } : {}), miniAppIds };
  }

  // A section type newer than this build.
  return null;
}

/**
 * Parse `data` of `GET /ui/home`. Returns null only when the payload is not a
 * layout at all (no `sections` array) — the caller then keeps its fallback.
 */
export function parseHomeLayout(raw: unknown): HomeLayout | null {
  const obj = asRecord(raw);
  if (!obj || !Array.isArray(obj.sections)) return null;
  return {
    version: typeof obj.version === 'number' ? obj.version : HOME_LAYOUT_VERSION,
    sections: obj.sections.map(parseSection).filter((s): s is HomeSection => s !== null),
  };
}
