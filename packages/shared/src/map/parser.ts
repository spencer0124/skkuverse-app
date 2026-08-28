/**
 * Map config + layer data parsers.
 *
 * Parser receives the full v2 envelope `{ meta, data }`.
 *
 * Flutter source: lib/features/campus_map/model/map_config.dart
 */

import type { ApiEnvelope } from '../api/types';
import type {
  MapConfig,
  NaverConfig,
  CampusDef,
  MapLayerDef,
  MapLayerStyle,
  RawMarkerData,
  MarkerTap,
  PolylineCoord,
} from '../types/map';
import { asMember, toFiniteNumber } from '../utils/allowlist';
import { CAMPUSES } from '../constants/campus';

const LAYER_TYPES = ['marker', 'polyline'] as const;
const MARKER_STYLES = [
  'numberCircle',
  'numberDot',
  'textLabel',
  'placeDot',
] as const;
/**
 * The tap kinds this build knows how to route. A kind outside the set leaves the
 * marker drawn but inert — see parseMarkerTap.
 */
const TAP_KINDS = ['skku_building', 'eskara26'] as const;

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

function parseLayerStyle(raw: Record<string, unknown>): MapLayerStyle {
  return {
    color: (raw.color as string) ?? undefined,
    outlineColor: (raw.outlineColor as string) ?? undefined,
    width: raw.width != null ? Number(raw.width) : undefined,
    size: raw.size != null ? Number(raw.size) : undefined,
    captionTextSize:
      raw.captionTextSize != null ? Number(raw.captionTextSize) : undefined,
  };
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
    defaultVisible: (raw.defaultVisible as boolean) ?? false,
    endpoint: raw.endpoint as string,
    markerStyle: asMember(raw.markerStyle, MARKER_STYLES),
    // Absent means `true`. Never fail closed: a server predating the field must
    // not silently strip every toggle off the filter sheet. Only an explicit
    // `false` locks the control.
    userConfigurable: raw.userConfigurable === false ? false : true,
    style: raw.style
      ? parseLayerStyle(raw.style as Record<string, unknown>)
      : undefined,
  };
}

// ── Public parsers ──

export function parseMapConfig(envelope: ApiEnvelope<unknown>): MapConfig {
  const data = envelope.data as Record<string, unknown>;
  return {
    naver: parseNaverConfig(
      (data.naver as Record<string, unknown>) ?? {},
    ),
    campuses: ((data.campuses as unknown[]) ?? [])
      .map((c) => parseCampusDef(c as Record<string, unknown>))
      .filter((c): c is CampusDef => c !== null),
    layers: ((data.layers as unknown[]) ?? []).map((l) =>
      parseLayerDef(l as Record<string, unknown>),
    ),
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
 * Keep an ISO instant only if it actually parses.
 *
 * A malformed string would reach the window comparison as `NaN`, and every
 * comparison against `NaN` is false — so `now >= startAt` and `now < endAt` both
 * fail and the marker silently never draws. Dropping to `null` means "unbounded
 * on that side", which draws.
 */
function parseInstant(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
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
    // /map/markers/campus, all six event layers from /map/markers/eskara26 — so
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
    const rawText = (raw.text ?? {}) as Record<string, unknown>;
    const ko = typeof rawText.ko === 'string' ? rawText.ko : '';
    if (ko === '') return [];
    const en = typeof rawText.en === 'string' && rawText.en !== '' ? rawText.en : ko;
    const zh = typeof rawText.zh === 'string' && rawText.zh !== '' ? rawText.zh : undefined;

    return [
      {
        id,
        layerId,
        lat,
        lng,
        campus,
        text: zh ? { ko, en, zh } : { ko, en },
        startAt: parseInstant(raw.startAt),
        endAt: parseInstant(raw.endAt),
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
