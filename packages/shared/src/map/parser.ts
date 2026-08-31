/**
 * Map config + layer data parsers.
 *
 * Parser receives the full v2 envelope `{ meta, data }`.
 *
 * Flutter source: lib/features/campus_map/model/map_config.dart
 */

import type { ApiEnvelope } from '../api/types';
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
  MapLayerDef,
  MapLayerStyle,
  MarkerAction,
  MarkerField,
  RawMarkerData,
  MarkerTap,
  PolylineCoord,
  TimeWindow,
} from '../types/map';
import { asMember, toFiniteNumber } from '../utils/allowlist';
import { parseActionType } from '../types/sdui';
import { CAMPUSES } from '../constants/campus';
import { toMinutesOfDay } from './daily-window';
import { DEFAULT_CAMERA_DEFAULTS, DEFAULT_MAP_CONFIG } from './defaults';

const LAYER_TYPES = ['marker', 'polyline'] as const;
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
/**
 * The tap kinds this build knows how to route. A kind outside the set leaves the
 * marker drawn but inert — see parseMarkerTap.
 */
const TAP_KINDS = ['skku_building', 'event'] as const;
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

function parseNaverConfig(raw: Record<string, unknown>): NaverConfig {
  return { styleId: (raw.styleId as string) ?? undefined };
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
    // Both fields used to be blind `as` casts. An unknown value was then typed as
    // a member of the union while matching no branch, so the layer vanished with
    // no error. 'marker' is the honest default here: CampusScreen's render loop is
    // a binary else that already draws anything non-'polyline' as a marker layer.
    type: asMember(raw.type, LAYER_TYPES) ?? 'marker',
    label: raw.label as string,
    defaultVisibleWhen: parseDefaultVisibleWhen(raw.defaultVisibleWhen),
    endpoint: raw.endpoint as string,
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
 * and the |lat| <= 90 guard is the same swap check parseMarkerData applies —
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
  return { id, label, icon: parseChipIcon(raw.icon), action, isReset: raw.isReset === true };
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
 * Opening hours, dropping any window that is not fully bounded.
 *
 * **Both bounds are required and a half-bounded window is dropped, not
 * repaired.** The wire has exactly one way to say "no limit" — the empty array —
 * and admitting a one-ended window here would quietly restore the second way,
 * which is the ambiguity that forced a `status` field to exist in the first
 * place. An unparseable bound is the same case: `Date.parse` returning `NaN`
 * makes every comparison false, so the window would silently never be open.
 *
 * A place whose every window is malformed lands on `[]`, which reads as ALWAYS
 * OPEN rather than never. That is the deliberate direction: an ops typo shows a
 * booth that is always listed as open, which somebody notices and reports; the
 * other way it vanishes from the map with nothing to report.
 */
function parseHours(raw: unknown): TimeWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const w = entry as Record<string, unknown>;
    const { startAt, endAt } = w;
    if (typeof startAt !== 'string' || Number.isNaN(Date.parse(startAt))) return [];
    if (typeof endAt !== 'string' || Number.isNaN(Date.parse(endAt))) return [];
    return [{ startAt, endAt }];
  });
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
    const style = asMember(a.style, ACTION_STYLES);
    return [
      {
        id: a.id,
        label,
        actionType: parseActionType(a.actionType),
        actionValue: a.actionValue,
        ...(style ? { style } : {}),
      },
    ];
  });
}

export function parseMarkerData(
  envelope: ApiEnvelope<unknown>,
): RawMarkerData[] {
  const data = envelope.data as Record<string, unknown>;
  const markers = (data.markers as unknown[]) ?? [];
  return markers.flatMap((m) => {
    const raw = m as Record<string, unknown>;

    // This was `Number(raw.lat ?? 0)`, and the `?? 0` was not even the whole bug:
    // `Number(null)` is 0 too, so a nulled coordinate produced a marker at Null
    // Island rather than no marker at all. Dropping is the only honest option —
    // there is no sensible default position for a thing whose position is missing.
    const lat = toFiniteNumber(raw.lat);
    const lng = toFiniteNumber(raw.lng);
    if (lat === null || lng === null) return [];
    // A [lng, lat] swap raises no error and lands in the ocean (ADR 0004 invariant
    // 3). Seoul's longitude is 126.97, so a swapped pair fails |lat| <= 90 here.
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];

    // Same reasoning as the coordinates: a marker we cannot place on a known
    // campus is not drawn. Defaulting to 'hssc' would put it on the wrong map,
    // which is worse than the old behaviour — an unrecognised string used to
    // fail the `m.campus === selectedCampus` filter and simply never render.
    const campus = asMember(raw.campus, CAMPUSES);
    if (!campus) return [];

    // Layers share endpoints — both building layers come from
    // /map/markers/campus, every event layer from /map/markers/event — so
    // `layerId` is what separates one layer's markers from another's. A marker
    // without it belongs to no layer, and keeping it would mean either drawing it
    // on every layer sharing the response or on none.
    const id = raw.id;
    const layerId = raw.layerId;
    if (typeof id !== 'string' || id === '') return [];
    if (typeof layerId !== 'string' || layerId === '') return [];

    // `ko` is the source language and always present upstream. Without it there
    // is nothing to draw, and a blank marker still occupies a tap target and a
    // caption-collision slot — which is why the server drops these too.
    const text = parseI18nText(raw.text);
    if (text === null) return [];

    return [
      {
        id,
        layerId,
        lat,
        lng,
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
        // `?? 0` on both, and they mean opposite things at 0 by design: `order`
        // is the LAST tiebreak so an equal one falls through to `id`, while
        // `pinPriority` 0 is the building's real value and the floor a booth
        // never sits at. Neither can make the collision ladder non-total.
        order: toFiniteNumber(raw.order) ?? 0,
        pinPriority: toFiniteNumber(raw.pinPriority) ?? 0,
        tap: parseMarkerTap(raw.tap),
      },
    ];
  });
}

export function parsePolylineData(
  envelope: ApiEnvelope<unknown>,
): PolylineCoord[] {
  const data = envelope.data as Record<string, unknown>;
  const coords = (data.coords as number[][]) ?? [];
  return coords.map(([lat, lng]) => [lat, lng] as PolylineCoord);
}
