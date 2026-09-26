/**
 * Map config + layer data parsers.
 *
 * Parser receives the full v2 envelope `{ meta, data }`.
 *
 * Flutter source: lib/features/campus_map/model/map_config.dart
 */

import type { ApiEnvelope } from '../api/types';
import { parseMiniAppTarget } from '../miniapps/target';
import type {
  DailyWindow,
  I18nText,
  LayerDefaultVisibility,
  MapConfig,
  NaverConfig,
  CampusDef,
  MapCameraDefaults,
  MapCameraMotion,
  MapChip,
  MapChipAction,
  MapChipCamera,
  MapChipIcon,
  MapChipFacet,
  MapChipFacetOption,
  MapChipList,
  MapLayerDef,
  MapLayerStyle,
  MapOverlay,
  MarkerAction,
  MarkerField,
  MarkerTap,
  LatLng,
  OpeningWindow,
  TimeWindow,
} from '../types/map';
import {
  PLACE_KINDS,
  type PlaceAction,
  type PlaceBlock,
  type PlaceBlockType,
  type PlaceDetail,
  type PlaceListItem,
  type PlaceTableRow,
} from '../types/placeDetail';
import { asMember, toFiniteNumber } from '../utils/allowlist';
import { parseActionType } from '../types/sdui';
import { CAMPUSES } from '../constants/campus';
import { toMinutesOfDay } from './daily-window';
import { toLatLng } from './geometry';
import {
  DEFAULT_CAMERA_DEFAULTS,
  DEFAULT_MAP_CONFIG,
  DEFAULT_NAVER_STYLE_ID,
} from './defaults';

/**
 * The renderers this build has. A `kind` outside the set drops that ONE
 * overlay — see parseOverlayData.
 *
 * This allowlist is where the open enum is absorbed, which is why the switch
 * downstream can be exhaustive without asserting `never`: an unknown wire value
 * never reaches it, and adding a member here without a case is a compile error
 * that forces the renderer to be written.
 */
const OVERLAY_KINDS = ['marker', 'polygon', 'path'] as const;
const MARKER_STYLES = [
  'numberCircle',
  'numberDot',
  'textLabel',
  'placeDot',
] as const;
/**
 * The marker shapes this build can draw. An unrecognised value resolves to
 * `undefined`, which the client reads as "the server did not say" and answers
 * with its own default — see `MapLayerStyle.shape` for why that direction is
 * the opposite of `MARKER_STYLES`'.
 */
const MARKER_SHAPES = ['pin', 'dot', 'dotThenPin'] as const;
const LOCATION_ACCURACIES = ['exact', 'area'] as const;
/**
 * The tap kinds this build knows how to route. A kind outside the set leaves the
 * marker drawn but inert — see parseMarkerTap.
 */
const TAP_KINDS = ['skku_building', 'event', 'chip'] as const;
/**
 * The chip actions this build can dispatch. A kind outside the set drops the
 * whole chip — see parseChip.
 */
const CHIP_ACTION_KINDS = ['webview', 'focus'] as const;
/**
 * The `defaultVisibleWhen` kinds this build can resolve. A kind outside the set
 * makes the declaration UNREADABLE — see parseDefaultVisibleWhen.
 */
const LAYER_VISIBILITY_KINDS = ['always', 'never', 'scheduled'] as const;
/** A button's emphasis. An unrecognised value falls back to the default look. */
const ACTION_STYLES = ['primary', 'secondary'] as const;

// ── Internal helpers ──

/** A response without a usable styleId still gets the bundled one — see DEFAULT_NAVER_STYLE_ID. */
function parseNaverConfig(raw: Record<string, unknown>): NaverConfig {
  const styleId = typeof raw.styleId === 'string' ? raw.styleId.trim() : '';
  return { styleId: styleId || DEFAULT_NAVER_STYLE_ID };
}

/**
 * Returns null for an unrecognised campus id. Defaulting would be worse than
 * dropping: it would render a toggle button for a campus whose markers all
 * belong to a different one.
 */
function parseCampusDef(raw: Record<string, unknown>): CampusDef | null {
  const id = asMember(raw.id, CAMPUSES);
  if (!id) return null;
  return {
    id,
    label: raw.label as string,
    centerLat: Number(raw.centerLat),
    centerLng: Number(raw.centerLng),
    defaultZoom: Number(raw.defaultZoom ?? 15.8),
    defaultTilt: Number(raw.defaultTilt ?? 0),
    defaultBearing: Number(raw.defaultBearing ?? 0),
    // Left unread for as long as it has existed, so `campuses[].radiusM` was
    // served, declared on CampusDef and consumed by campusProximity — and every
    // campus still silently used the hardcoded fallback. `toFiniteNumber` rather
    // than `Number()`: a null must stay absent so the fallback applies, not
    // become a 0 m radius that puts the camera outside every campus.
    radiusM: toFiniteNumber(raw.radiusM) ?? undefined,
  };
}

/**
 * `toFiniteNumber` rather than `Number()`, for the same reason a coordinate
 * uses it: `Number('16px')`, `Number(true)` and `Number({})` are all `NaN`, and
 * `NaN ?? PIN_WIDTH` is `NaN` — so the component's fallback never fires and the
 * marker draws at width NaN with a React key of `...-NaN`. These members drive
 * real geometry now, so "a server sending none of them renders exactly as one
 * that never had them" has to hold for a server sending a bad one too.
 */
function parseLayerStyle(raw: Record<string, unknown>): MapLayerStyle {
  return {
    color: (raw.color as string) ?? undefined,
    outlineColor: (raw.outlineColor as string) ?? undefined,
    // The two the SDK's own defaults make mandatory in practice: its polygon
    // `color` defaults to opaque black and its `outlineWidth` to 0, so a zone
    // served without these is a borderless dark blob over the booths it groups.
    outlineWidth: toFiniteNumber(raw.outlineWidth) ?? undefined,
    fillOpacity: toFiniteNumber(raw.fillOpacity) ?? undefined,
    minZoom: toFiniteNumber(raw.minZoom) ?? undefined,
    maxZoom: toFiniteNumber(raw.maxZoom) ?? undefined,
    width: toFiniteNumber(raw.width) ?? undefined,
    height: toFiniteNumber(raw.height) ?? undefined,
    size: toFiniteNumber(raw.size) ?? undefined,
    captionTextSize: toFiniteNumber(raw.captionTextSize) ?? undefined,
    zIndex: toFiniteNumber(raw.zIndex) ?? undefined,
    shape: asMember(raw.shape, MARKER_SHAPES),
  };
}

/**
 * One daily window, or `null`.
 *
 * The bounds are kept as the strings they arrived as rather than as minutes: the
 * wire shape is what `isDailyWindowOpen` reads, and storing a parsed number
 * beside them would be a second representation to keep in step. `toMinutesOfDay`
 * is borrowed only to VALIDATE, which is what keeps the two spellings of an hour
 * from diverging between this file and the evaluator.
 */
function parseDailyWindow(raw: unknown): DailyWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  const { start, end } = w;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const startMin = toMinutesOfDay(start);
  const endMin = toMinutesOfDay(end);
  if (startMin === null || endMin === null) return null;
  // Equal bounds are ambiguous between "zero minutes" and "all day", so they are
  // not a window at all. A layer on all day says `{ kind: 'always' }`.
  if (startMin === endMin) return null;
  return { start, end };
}

/**
 * When a layer is on by default, or `null` for a declaration this build cannot
 * read.
 *
 * **`null` resolves to OFF, and that direction is deliberate.** The instinct is
 * to fail open — a layer wrongly hidden is invisible, a layer wrongly shown is
 * merely noise — and it is the wrong instinct here, because this whole axis
 * exists to put LESS on screen. A future server adding a `kind` this build has
 * not heard of would, under a fail-open reading, draw 주점 at noon: the exact
 * crowding the feature removes. ArcGIS makes the same call with a layer type it
 * cannot support, keeping it in the model and declining to render it rather than
 * coercing it to some default type, and protobuf's rule for an unrecognised enum
 * is the same shape — read it as unspecified, never as a known value.
 *
 * Two things stop that becoming a silent failure of its own. The layer keeps its
 * filter-sheet tile, so a user can still turn it on; and if NO layer in a
 * response is readable, `parseMapConfig` falls back to the bundled config rather
 * than serving an empty map.
 */
function parseDefaultVisibleWhen(raw: unknown): LayerDefaultVisibility | null {
  if (!raw || typeof raw !== 'object') return null;
  const when = raw as Record<string, unknown>;
  const kind = asMember(when.kind, LAYER_VISIBILITY_KINDS);
  if (!kind) return null;
  if (kind !== 'scheduled') return { kind };

  if (!Array.isArray(when.windows)) return null;
  const windows = when.windows
    .map(parseDailyWindow)
    .filter((w): w is DailyWindow => w !== null);
  // A `scheduled` layer whose every window failed to parse has said "sometimes"
  // and left no way to know when. Neither `always` nor `never` honours that, so
  // it joins the unreadable state rather than being guessed at. Surviving
  // windows are kept: partial data is still a statement of intent.
  if (windows.length === 0) return null;
  return { kind, windows };
}

function parseLayerDef(raw: Record<string, unknown>): MapLayerDef {
  return {
    id: raw.id as string,
    label: raw.label as string,
    defaultVisibleWhen: parseDefaultVisibleWhen(raw.defaultVisibleWhen),
    endpoint: raw.endpoint as string,
    // A blind `as` cast here used to type an unknown value as a union member it
    // was not; it then matched no render branch, so the thing vanished with no
    // error and nothing to grep for. `asMember` checks rather than asserts.
    // There is deliberately no layer `type` beside this — an overlay's own
    // `kind` names its renderer now.
    markerStyle: asMember(raw.markerStyle, MARKER_STYLES),
    // Absent means `true`. Never fail closed: a server predating the field must
    // not silently strip every toggle off the filter sheet. Only an explicit
    // `false` locks the control. Note this is the OPPOSITE direction from
    // `defaultVisibleWhen` above, and both are right: this one governs an
    // affordance, where failing closed removes the user's only way to act, while
    // that one governs what is drawn, where failing open contradicts the rule
    // the server was trying to state.
    userConfigurable: raw.userConfigurable === false ? false : true,
    // Absent means `null`, which is the server's own meaningful value: a layer
    // no chip may ever change. Fails in the safe direction, so a server
    // predating the field cannot have its base layers swapped by a chip.
    chipGroupId:
      typeof raw.chipGroupId === 'string' && raw.chipGroupId !== ''
        ? raw.chipGroupId
        : null,
    style: raw.style
      ? parseLayerStyle(raw.style as Record<string, unknown>)
      : undefined,
  };
}

/**
 * A finite number, or the fallback. `toFiniteNumber` rather than `Number()`
 * because `Number(null)` is 0 — a zoom of 0 is the whole planet and a duration
 * of 0 is a teleport, and neither is what "the server did not say" means.
 */
function motionMember(raw: unknown, fallback: number): number {
  return toFiniteNumber(raw) ?? fallback;
}

function parseCameraMotion(
  raw: unknown,
  fallback: MapCameraMotion,
): MapCameraMotion {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    zoom: motionMember(m.zoom, fallback.zoom),
    tilt: motionMember(m.tilt, fallback.tilt),
    bearing: motionMember(m.bearing, fallback.bearing),
    durationMs: motionMember(m.durationMs, fallback.durationMs),
  };
}

function parseCameraDefaults(raw: unknown): MapCameraDefaults {
  const d = (raw ?? {}) as Record<string, unknown>;
  const campusFocus = (d.campusFocus ?? {}) as Record<string, unknown>;
  return {
    markerFocus: parseCameraMotion(
      d.markerFocus,
      DEFAULT_CAMERA_DEFAULTS.markerFocus,
    ),
    campusFocus: {
      durationMs: motionMember(
        campusFocus.durationMs,
        DEFAULT_CAMERA_DEFAULTS.campusFocus.durationMs,
      ),
    },
  };
}

/**
 * Narrow a chip icon, or `null`.
 *
 * `null` is a declared state rather than a failure — a text-only chip is an
 * ordinary thing to want — so an unrecognised icon degrades to it instead of
 * dropping the chip. The label is what the chip is; the mark beside it is not.
 */
function parseChipIcon(raw: unknown): MapChipIcon | null {
  if (!raw || typeof raw !== 'object') return null;
  const icon = raw as Record<string, unknown>;
  if (icon.kind !== 'emoji') return null;
  return typeof icon.emoji === 'string' && icon.emoji !== ''
    ? { kind: 'emoji', emoji: icon.emoji }
    : null;
}

/**
 * A chip camera, or `null` when it names no usable position.
 *
 * The motion members fall back to the RESPONSE's own `markerFocus`, not to the
 * bundled default — a server that raises the marker zoom and ships a chip
 * omitting `zoom` must not have that chip focus at the old value, which is the
 * very disagreement `cameraDefaults` exists to remove. The coordinate does not
 * fall back at all: there is
 * no sensible default position for a thing whose whole purpose is to name one,
 * and the |lat| <= 90 guard is the same swap check parseOverlayData applies —
 * Seoul's longitude is 126.97, so a swapped pair fails it.
 */
function parseChipCamera(
  raw: unknown,
  fallback: MapCameraMotion,
): MapChipCamera | null {
  if (!raw || typeof raw !== 'object') return null;
  const cam = raw as Record<string, unknown>;
  const lat = toFiniteNumber(cam.lat);
  const lng = toFiniteNumber(cam.lng);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, ...parseCameraMotion(cam, fallback) };
}

function parseChipAction(
  raw: unknown,
  cameraFallback: MapCameraMotion,
): MapChipAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const action = raw as Record<string, unknown>;
  const kind = asMember(action.kind, CHIP_ACTION_KINDS);
  if (!kind) return null;

  if (kind === 'webview') {
    const url = action.url;
    if (typeof url !== 'string' || url === '') return null;
    return { kind, url };
  }

  const camera = parseChipCamera(action.camera, cameraFallback);
  if (!camera) return null;

  // A non-array drops the chip rather than coercing to `[]`. `[]` is already the
  // spelling for the camera-only chip, so a `null` or a string is a contract
  // violation and not a second way to say the same thing — and coercing it would
  // turn a server bug into a chip that moves the camera and silently changes
  // nothing, with no signal anywhere.
  if (!Array.isArray(action.layerIds)) return null;
  // Entries are filtered rather than trusted: a non-string id would reach the
  // group resolution and match no layer, which is survivable and not worth
  // dropping a whole chip over.
  const layerIds = action.layerIds.filter(
    (id): id is string => typeof id === 'string' && id !== '',
  );
  return { kind, camera, layerIds };
}

const FACET_SELECTS = ['required', 'optional'] as const;

function parseFacetOption(raw: unknown): MapChipFacetOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id === '') return null;
  if (typeof o.label !== 'string' || o.label === '') return null;
  // A malformed window costs only the "open on today" default; the option
  // itself still filters, so it is kept with `null`.
  const window = parseBoundedWindow(o.window);
  return { id: o.id, label: o.label, window };
}

function parseFacet(raw: unknown): MapChipFacet | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (typeof f.id !== 'string' || f.id === '') return null;
  if (typeof f.label !== 'string' || f.label === '') return null;
  const select = asMember(f.select, FACET_SELECTS);
  if (!select) return null;
  const options = parseEach(f.options, parseFacetOption);
  // A tab row with nothing to press is worse than no row.
  if (options.length === 0) return null;
  return { id: f.id, label: f.label, select, options };
}

/**
 * A chip's list, or `null` — which the list reads as unfiltered and in
 * `order`, what every chip meant before lists existed.
 *
 * Every failure degrades TOWARD SHOWING MORE. A dropped facet filters nothing,
 * an unknown sort key falls back to `order`, and a scope that no longer names a
 * kept facet is cleared — so a malformed list can reorder rows but never hide
 * one.
 */
function parseChipList(raw: unknown): MapChipList | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  const facets = parseEach(l.facets, parseFacet);
  const sortRaw = (l.sort && typeof l.sort === 'object' ? l.sort : {}) as Record<string, unknown>;
  if (sortRaw.key === 'title') return { facets, sort: { key: 'title', scopeFacetId: null } };
  const scope = sortRaw.scopeFacetId;
  const scopeFacetId =
    typeof scope === 'string' && facets.some((f) => f.id === scope)
      ? scope
      : null;
  return { facets, sort: { key: 'order', scopeFacetId } };
}

/** `{ facetId: optionId[] }`. Anything else is `{}` — in no option, so filtered out only when filtering. */
function parseFacetMembership(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    out[key] = value.filter((v): v is string => typeof v === 'string');
  }
  return out;
}

/** `{ optionId: number }`, keeping only finite numbers. */
function parseOrderByOption(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = toFiniteNumber(value);
    if (n !== null) out[key] = n;
  }
  return out;
}

/**
 * A chip, or `null`.
 *
 * Dropped rather than kept inert, which is deliberately the opposite call from
 * `parseMarkerTap`: a marker is a *place* that also happens to be tappable, so
 * an unroutable one is still worth drawing, while a chip *is* its action — an
 * unroutable chip is a button that visibly does nothing, and a missing button
 * is better than a dead one.
 */
function parseChip(
  raw: Record<string, unknown>,
  cameraFallback: MapCameraMotion,
): MapChip | null {
  const id = raw.id;
  const label = raw.label;
  if (typeof id !== 'string' || id === '') return null;
  // A chip renders as its label. Without one there is nothing to press.
  if (typeof label !== 'string' || label === '') return null;
  const action = parseChipAction(raw.action, cameraFallback);
  if (!action) return null;
  // Only an explicit `true` is a reset. Absent means an ordinary narrowing chip,
  // which is what every authored chip is — and it is the safe direction, since
  // mistaking a narrowing chip for a reset would silently drop the user's view
  // instead of applying the one they asked for.
  return {
    id,
    label,
    icon: parseChipIcon(raw.icon),
    action,
    isReset: raw.isReset === true,
    list: parseChipList(raw.list),
  };
}

// ── Public parsers ──

export function parseMapConfig(envelope: ApiEnvelope<unknown>): MapConfig {
  const data = envelope.data as Record<string, unknown>;
  // Parsed before the chips, because a chip's own camera fills its missing
  // members from `markerFocus` — the two must not be able to disagree.
  const cameraDefaults = parseCameraDefaults(data.cameraDefaults);
  const layers = ((data.layers as unknown[]) ?? []).map((l) =>
    parseLayerDef(l as Record<string, unknown>),
  );

  // The floor under `defaultVisibleWhen`'s fail-closed reading.
  //
  // One unreadable layer is survivable — it is off, it still has a tile, and the
  // user can turn it on. EVERY layer unreadable is a response this build cannot
  // draw a map from, and resolving each one to OFF would leave an empty campus:
  // no 건물번호, no 건물이름, nothing. The bundled config is a real map, so it is
  // a better answer than an honest blank one. The chips go with it, since a chip
  // naming layers we could not read means nothing either.
  //
  // This mirrors the server's own load-time rule that a config must carry at
  // least one layer that is not `never`.
  if (layers.length > 0 && layers.every((l) => l.defaultVisibleWhen === null)) {
    return DEFAULT_MAP_CONFIG;
  }

  return {
    naver: parseNaverConfig(
      (data.naver as Record<string, unknown>) ?? {},
    ),
    campuses: ((data.campuses as unknown[]) ?? [])
      .map((c) => parseCampusDef(c as Record<string, unknown>))
      .filter((c): c is CampusDef => c !== null),
    layers,
    chips: ((data.chips as unknown[]) ?? [])
      .map((c) =>
        parseChip((c ?? {}) as Record<string, unknown>, cameraDefaults.markerFocus),
      )
      .filter((c): c is MapChip => c !== null),
    cameraDefaults,
  };
}

/**
 * Narrow `tap` to a kind this build can route, or `null`.
 *
 * An unrecognised kind returns `null` rather than dropping the marker: a kind we
 * cannot route is still a place we can draw, and a missing pin is a failure
 * nobody can see or report while an inert one is obvious. That is the same
 * fail-soft the server's own degraded building fallback takes, which ships
 * `tap: null` deliberately because there is no document behind those markers.
 */
function parseMarkerTap(raw: unknown): MarkerTap | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const kind = asMember(t.kind, TAP_KINDS);
  if (!kind) return null;
  if (kind === 'chip') {
    // Runs a chip rather than opening a place. Which chip is checked where the
    // tap lands, against the chips this build actually holds.
    const chipId = t.chipId;
    if (typeof chipId !== 'string' || chipId === '') return null;
    return { kind, chipId };
  }
  const placeId = t.placeId;
  if (typeof placeId !== 'string' || placeId === '') return null;
  return { kind, placeId };
}

/**
 * An i18n string set, or `null` when there is no Korean to fall back to.
 *
 * `ko` is the source language and always present upstream, so its absence is a
 * broken record rather than an untranslated one. `en` falls back to `ko`, and
 * `zh` is omitted entirely when nobody authored one — which is the normal case
 * for a building.
 */
function parseI18nText(raw: unknown): I18nText | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const ko = typeof t.ko === 'string' ? t.ko : '';
  if (ko === '') return null;
  const en = typeof t.en === 'string' && t.en !== '' ? t.en : ko;
  const zh = typeof t.zh === 'string' && t.zh !== '' ? t.zh : undefined;
  return zh ? { ko, en, zh } : { ko, en };
}

/**
 * Opening hours, dropping any window without a real start.
 *
 * **The start is required; the end may be `null`** — an end the organiser has
 * not announced. That is not a second way to say "no limit", because the start
 * still gates the window. A window with no start WOULD be, and is dropped, not
 * repaired: the wire has exactly one way to say "no limit" — the empty array —
 * and a start-less window would quietly restore the second way, which is the
 * ambiguity that forced a `status` field to exist in the first place. An
 * unparseable bound is dropped the same way: `Date.parse` returning `NaN` makes
 * every comparison false, so the window would silently never be open. An end
 * that is present but unparseable drops the window too, rather than reading as
 * unannounced.
 *
 * A place whose every window is malformed lands on `[]`, which reads as ALWAYS
 * OPEN rather than never. That is the deliberate direction: an ops typo shows a
 * booth that is always listed as open, which somebody notices and reports; the
 * other way it vanishes from the map with nothing to report.
 */
function parseHours(raw: unknown): OpeningWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): OpeningWindow[] => {
    if (!entry || typeof entry !== 'object') return [];
    const w = entry as Record<string, unknown>;
    const { startAt, endAt } = w;
    if (typeof startAt !== 'string' || Number.isNaN(Date.parse(startAt))) return [];
    if (endAt == null) return [{ startAt, endAt: null, label: parseI18nText(w.label) }];
    if (typeof endAt !== 'string' || Number.isNaN(Date.parse(endAt))) return [];
    return [{ startAt, endAt, label: parseI18nText(w.label) }];
  });
}

/**
 * A day option's span — BOTH bounds required, unlike a place's hours: a day
 * always ends, and "open on today" is decided against its end.
 */
function parseBoundedWindow(raw: unknown): TimeWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const { startAt, endAt } = raw as Record<string, unknown>;
  if (typeof startAt !== 'string' || Number.isNaN(Date.parse(startAt))) return null;
  if (typeof endAt !== 'string' || Number.isNaN(Date.parse(endAt))) return null;
  return { startAt, endAt };
}

/** Card rows. A row missing either half is dropped; a half-drawn row says nothing. */
function parseFields(raw: unknown): MarkerField[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const f = entry as Record<string, unknown>;
    const label = parseI18nText(f.label);
    const value = parseI18nText(f.value);
    return label && value ? [{ label, value }] : [];
  });
}

/**
 * Sheet buttons.
 *
 * A button with no id, no label or no value is dropped and the place is served
 * without it — the same call the server makes on its own side, and for the same
 * reason: losing a button is recoverable in a way that dropping the booth is
 * not. `actionType` is NOT a drop condition, because `parseActionType` already
 * degrades an unknown kind to `'unknown'`, which the action handler declines to
 * open. A button that does nothing is better than a booth that is missing.
 *
 * The one type-specific check is `miniapp`: a value that is not a mini-app
 * target (`<miniAppId>[/path]`) has nowhere to go, and the pill would render
 * with a logo lookup that finds nothing and a tap that does nothing. The server
 * refuses the same values before it ships them, so this only fires on drift.
 */
function parseActions(raw: unknown): MarkerAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const a = entry as Record<string, unknown>;
    const label = parseI18nText(a.label);
    if (typeof a.id !== 'string' || a.id === '') return [];
    if (label === null) return [];
    if (typeof a.actionValue !== 'string' || a.actionValue === '') return [];
    const actionType = parseActionType(a.actionType);
    if (actionType === 'miniapp' && !parseMiniAppTarget(a.actionValue)) return [];
    const style = asMember(a.style, ACTION_STYLES);
    return [
      {
        id: a.id,
        label,
        actionType,
        actionValue: a.actionValue,
        ...(style ? { style } : {}),
      },
    ];
  });
}

/**
 * A GeoJSON geometry object of the expected type, or `null`.
 *
 * The type is checked against the overlay's `kind` rather than trusted, because
 * the two can disagree — a `kind: "marker"` carrying a Polygon is a document
 * nobody can draw, and guessing which half the author meant is how a renderer
 * crashes two calls later on a shape it was never handed.
 */
function geometryOfType(raw: unknown, type: string): { coordinates: unknown } | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (g.type !== type) return null;
  return { coordinates: g.coordinates };
}

/**
 * A coordinate sequence, or `null` if ANY position in it is unreadable.
 *
 * All-or-nothing on purpose. A line missing one vertex is a different route and
 * a ring missing one corner is a different shape, so a partial conversion draws
 * something confidently wrong over a campus — worse than drawing nothing, and
 * much harder to notice. `min` is the shortest sequence the geometry can mean.
 */
function toLatLngs(raw: unknown, min: number): LatLng[] | null {
  if (!Array.isArray(raw) || raw.length < min) return null;
  const out: LatLng[] = [];
  for (const position of raw) {
    const point = toLatLng(position);
    if (point === null) return null;
    out.push(point);
  }
  return out;
}

/**
 * A Polygon's rings — `[0]` exterior, the rest holes — or `null`.
 *
 * Four positions minimum per ring, not three: a triangle is three corners plus
 * the repeat that closes it. The repeat is KEPT rather than trimmed, because
 * the SDK wants a closed ring and re-closing it downstream would put the same
 * knowledge in two places. Matches the server's own `isDrawableGeometry`.
 */
function toRings(raw: unknown): LatLng[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rings: LatLng[][] = [];
  for (const ring of raw) {
    const points = toLatLngs(ring, 4);
    if (points === null) return null;
    rings.push(points);
  }
  return rings;
}

/**
 * The overlay collection for one data source — pins, zones and route lines
 * together, each tagged by the renderer that draws it.
 *
 * This replaced a parser reading `data.markers`. When the server moved to
 * `data.overlays` the shipped app kept fetching happily and coalescing the
 * absent key to `[]`, so the campus map went blank against a 200 response with
 * nothing in any log — the failure mode a server-driven `endpoint` makes
 * possible, since there was no 404 to notice.
 *
 * ## Every drop is one overlay
 *
 * A malformed document, an unknown `kind`, a coordinate that will not read: all
 * of them `return []` for that entry and leave its layer and its siblings
 * alone. A layer with forty booths and one unusable ground image draws forty
 * booths. That granularity is what makes `kind` genuinely open — the server
 * ships a new renderer without a client release, and old builds skip it.
 *
 * The `switch` below is exhaustive and carries no `never` assertion, which
 * looks like a contradiction and is not: `OVERLAY_KINDS` absorbs the openness
 * first, so an unrecognised wire value is already gone by the time the switch
 * runs. What exhaustiveness buys is the other direction — adding a member to
 * that allowlist without writing its case is a compile error.
 */
export function parseOverlayData(envelope: ApiEnvelope<unknown>): MapOverlay[] {
  const data = envelope.data as Record<string, unknown>;
  const overlays = (data.overlays as unknown[]) ?? [];
  // The callback is annotated rather than inferred: without it TypeScript
  // widens the switch's arms to a union OF ARRAYS, which `flatMap` cannot
  // reconcile against a single element type.
  return overlays.flatMap((entry): MapOverlay[] => {
    const raw = entry as Record<string, unknown>;

    const kind = asMember(raw.kind, OVERLAY_KINDS);
    if (!kind) return [];

    // A place we cannot put on a known campus is not drawn. Defaulting to
    // 'hssc' would put it on the wrong map, which is worse than the old
    // behaviour — an unrecognised string used to fail the campus filter and
    // simply never render.
    const campus = asMember(raw.campus, CAMPUSES);
    if (!campus) return [];

    // Layers share endpoints — both building layers come from
    // /map/overlays/campus, every event layer from /map/overlays/event — so
    // `layerId` is what separates one layer's overlays from another's. An
    // overlay without it belongs to no layer, and keeping it would mean drawing
    // it on every layer reading that response, or on none.
    const id = raw.id;
    const layerId = raw.layerId;
    if (typeof id !== 'string' || id === '') return [];
    if (typeof layerId !== 'string' || layerId === '') return [];

    // `ko` is the source language and always present upstream. Without it there
    // is nothing to draw, and a blank overlay still occupies a tap target and a
    // caption-collision slot — which is why the server drops these too.
    const text = parseI18nText(raw.text);
    if (text === null) return [];

    const base = {
      id,
      layerId,
      campus,
      text,
      // `null` for every building, and stated emptiness rather than an absent
      // key for the booth-shaped half of the schema — an absent field is a
      // second thing for this parser to branch on.
      subtitle: parseI18nText(raw.subtitle),
      // `[]` reads as ALWAYS OPEN downstream, which is also what a building
      // wants, so the absent-field fallback and the building's real answer are
      // the same value rather than two.
      hours: parseHours(raw.hours),
      fields: parseFields(raw.fields),
      actions: parseActions(raw.actions),
      // The LAST tiebreak in a collision, so an equal one falls through to
      // `id`. `?? 0` rather than NaN, which would make every comparison in the
      // ladder false and the ladder non-total.
      order: toFiniteNumber(raw.order) ?? 0,
      facets: parseFacetMembership(raw.facets),
      orderByOption: parseOrderByOption(raw.orderByOption),
      // `null` is meaningful: a backdrop that is drawn and not pressable.
      tap: parseMarkerTap(raw.tap),
    };

    switch (kind) {
      case 'marker': {
        const at = geometryOfType(raw.geometry, 'Point');
        const point = at && toLatLng(at.coordinates);
        if (!point) return [];
        return [
          {
            ...base,
            kind,
            lat: point.lat,
            lng: point.lng,
            // 0 is the building's real value and the floor a booth never sits
            // at, so unlike `order` this default is a fact rather than a
            // fallback.
            pinPriority: toFiniteNumber(raw.pinPriority) ?? 0,
            // Absent from every server before it existed, and from buildings'
            // meaning: a pin is the place's spot unless the server says it
            // names only an area. An unknown value reads the same way — the
            // old behaviour, not a guess.
            locationAccuracy: asMember(raw.locationAccuracy, LOCATION_ACCURACIES) ?? 'exact',
          },
        ];
      }
      case 'polygon': {
        const g = geometryOfType(raw.geometry, 'Polygon');
        const rings = g && toRings(g.coordinates);
        if (!rings) return [];
        return [{ ...base, kind, rings }];
      }
      case 'path': {
        const g = geometryOfType(raw.geometry, 'LineString');
        const line = g && toLatLngs(g.coordinates, 2);
        if (!line) return [];
        return [{ ...base, kind, line }];
      }
    }
  });
}

// ── Place details ─────────────────────────────────────────────────────────

/**
 * The block types this build can draw. A `type` outside the set drops that ONE
 * block and leaves the rest of the body, the same way `OVERLAY_KINDS` absorbs
 * an overlay kind — so the switch in `parsePlaceBlock` can be exhaustive
 * without asserting `never`.
 */
const PLACE_BLOCK_TYPES = ['text', 'list', 'table', 'image', 'notice'] as const satisfies readonly PlaceBlockType[];

/**
 * `data` of `GET /map/overlays/event/details` — every served place's sheet
 * body, keyed by the `tap.placeId` its overlay carries.
 *
 * Fail soft and as narrowly as the server does: a broken row drops from its
 * block, a broken block or action drops from its detail, and a detail drops
 * whole only when it has no id or its `kind` is not one this build knows
 * (`PLACE_KINDS` is closed). A place with no detail is simply absent, which the
 * sheet already reads as "draw the overlay alone".
 *
 * Keyed by the detail's own `placeId` rather than the record's key, so the id a
 * sheet looks up is the one the server stated for that body.
 */
export function parsePlaceDetails(envelope: ApiEnvelope<unknown>): Record<string, PlaceDetail> {
  const data = envelope.data as Record<string, unknown> | null;
  const raw = data?.details;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, PlaceDetail> = {};
  for (const entry of Object.values(raw as Record<string, unknown>)) {
    const detail = parsePlaceDetail(entry);
    if (detail) out[detail.placeId] = detail;
  }
  return out;
}

function parsePlaceDetail(raw: unknown): PlaceDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.placeId !== 'string' || d.placeId === '') return null;
  const kind = asMember(d.kind, PLACE_KINDS);
  if (!kind) return null;
  return {
    placeId: d.placeId,
    kind,
    org: parseI18nText(d.org),
    isUnion: d.isUnion === true,
    locationLabel: parseI18nText(d.locationLabel),
    actions: parseEach(d.actions, parsePlaceAction),
    blocks: parseEach(d.blocks, parsePlaceBlock),
  };
}

/** An absolute `https:` URL, or `null`. Everything the sheet opens or loads is one. */
function httpsUrl(raw: unknown): string | null {
  return typeof raw === 'string' && /^https:\/\/[^\s/]+/.test(raw) ? raw : null;
}

/** Keeps the entries `parse` accepts; an empty result is the caller's to reject. */
function parseEach<T>(raw: unknown, parse: (entry: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.flatMap((entry) => parse(entry) ?? []) : [];
}

function parseListItem(raw: unknown): PlaceListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const i = raw as Record<string, unknown>;
  const title = parseI18nText(i.title);
  if (title === null) return null;
  return {
    emoji: typeof i.emoji === 'string' && i.emoji !== '' ? i.emoji : null,
    title,
    description: parseI18nText(i.description),
  };
}

function parseTableRow(raw: unknown): PlaceTableRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const label = parseI18nText(r.label);
  const value = parseI18nText(r.value);
  return label && value ? { label, value } : null;
}

/**
 * One body block, or `null`. A list, table or notice with no readable row is
 * dropped rather than drawn as a heading over nothing.
 */
function parsePlaceBlock(raw: unknown): PlaceBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const type = asMember(b.type, PLACE_BLOCK_TYPES);
  if (!type) return null;
  if (typeof b.id !== 'string' || b.id === '') return null;
  const id = b.id;
  const title = parseI18nText(b.title);

  switch (type) {
    case 'text': {
      const body = parseI18nText(b.body);
      return body ? { type, id, title, body } : null;
    }
    case 'list': {
      const items = parseEach(b.items, parseListItem);
      return items.length > 0 ? { type, id, title, items } : null;
    }
    case 'table': {
      const rows = parseEach(b.rows, parseTableRow);
      return rows.length > 0 ? { type, id, title, rows } : null;
    }
    case 'image': {
      const url = httpsUrl(b.url);
      return url ? { type, id, title, url, caption: parseI18nText(b.caption) } : null;
    }
    case 'notice': {
      const items = parseEach(b.items, parseI18nText);
      return items.length > 0 ? { type, id, title, items } : null;
    }
  }
}

/** A sheet action, or `null`. An unknown `type` drops that one button. */
function parsePlaceAction(raw: unknown): PlaceAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.id !== 'string' || a.id === '') return null;
  const label = parseI18nText(a.label);
  if (label === null) return null;
  if (a.type === 'link') {
    const url = httpsUrl(a.url);
    return url ? { type: 'link', id: a.id, label, url } : null;
  }
  if (a.type === 'instagram') {
    const profileUrl = httpsUrl(a.profileUrl);
    if (profileUrl === null) return null;
    return { type: 'instagram', id: a.id, label, profileUrl, postUrl: httpsUrl(a.postUrl) };
  }
  return null;
}
