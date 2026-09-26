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
 * A grid's tiles each carry a `kind` naming where the tile's text and icon come
 * from: `miniapp` (joined from the mini-app registry, `useMiniAppIndex`), `game`
 * (a game bundled into the app, resolved by the app) or `link` (text, icon and
 * action inline). The kind is an OPEN set: a tile of a kind this build does not
 * know is dropped alone, never the grid.
 */
import { parseLogo, type MiniAppLogo } from '../miniapps/schema';
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

export type HomeTile =
  | { kind: 'miniapp'; id: string }
  | { kind: 'game'; id: string }
  | {
      kind: 'link';
      id: string;
      title: string;
      icon: MiniAppLogo;
      action: { actionType: ActionType; actionValue: string };
    };

export interface HomeTileGrid {
  type: 'tile_grid';
  id: string;
  title?: string;
  tiles: HomeTile[];
}

export type HomeSection = HomeBannerCarousel | HomeTileGrid;

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

/**
 * One `banner_carousel` section, or null when it has no id. Exported for the
 * campus feed (`GET /ui/home/campus`), whose carousel the server builds from
 * the same rules and sends in the same shape.
 */
export function parseBannerCarousel(raw: unknown): HomeBannerCarousel | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  if (!obj || !id) return null;
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

function parseTile(raw: unknown): HomeTile | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  if (!obj || !id) return null;
  switch (obj.kind) {
    case 'miniapp':
    case 'game':
      return { kind: obj.kind, id };
    case 'link': {
      const title = asString(obj.title);
      const icon = parseLogo(obj.icon);
      const actionType = parseActionType(obj.actionType);
      const actionValue = asString(obj.actionValue);
      // Unlike a banner, a tile that cannot be pressed has nothing left to show.
      if (!title || !icon || actionType === 'unknown' || !actionValue) return null;
      return { kind: 'link', id, title, icon, action: { actionType, actionValue } };
    }
    default:
      // A tile kind newer than this build.
      return null;
  }
}

function parseGrid(obj: Record<string, unknown>, id: string, tiles: HomeTile[]): HomeTileGrid | null {
  if (tiles.length === 0) return null;
  const title = asString(obj.title);
  return { type: 'tile_grid', id, ...(title ? { title } : {}), tiles };
}

function parseSection(raw: unknown): HomeSection | null {
  const obj = asRecord(raw);
  const id = asString(obj?.id);
  if (!obj || !id) return null;

  if (obj.type === 'banner_carousel') return parseBannerCarousel(obj);

  if (obj.type === 'tile_grid') {
    const tiles = Array.isArray(obj.tiles)
      ? obj.tiles.map(parseTile).filter((t): t is HomeTile => t !== null)
      : [];
    return parseGrid(obj, id, tiles);
  }

  // TODO(remove once skkuverse-server serves `tile_grid`): the section this
  // replaced, still read so this build can ship before the server switches.
  if (obj.type === 'miniapp_grid') {
    const tiles = Array.isArray(obj.miniAppIds)
      ? obj.miniAppIds
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .map((miniAppId): HomeTile => ({ kind: 'miniapp', id: miniAppId }))
      : [];
    return parseGrid(obj, id, tiles);
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
