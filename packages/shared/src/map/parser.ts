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
  PolylineCoord,
} from '../types/map';

// ── Internal helpers ──

function parseNaverConfig(raw: Record<string, unknown>): NaverConfig {
  return { styleId: (raw.styleId as string) ?? undefined };
}

function parseCampusDef(raw: Record<string, unknown>): CampusDef {
  return {
    id: raw.id as string,
    label: raw.label as string,
    centerLat: Number(raw.centerLat),
    centerLng: Number(raw.centerLng),
    defaultZoom: Number(raw.defaultZoom ?? 15.8),
    defaultTilt: Number(raw.defaultTilt ?? 0),
    defaultBearing: Number(raw.defaultBearing ?? 0),
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
    type: raw.type as 'marker' | 'polyline',
    label: raw.label as string,
    defaultVisible: (raw.defaultVisible as boolean) ?? false,
    endpoint: raw.endpoint as string,
    markerStyle: (raw.markerStyle as 'numberCircle' | 'numberDot' | 'textLabel') ?? undefined,
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
    campuses: ((data.campuses as unknown[]) ?? []).map((c) =>
      parseCampusDef(c as Record<string, unknown>),
    ),
    layers: ((data.layers as unknown[]) ?? []).map((l) =>
      parseLayerDef(l as Record<string, unknown>),
    ),
  };
}

export function parseMarkerData(
  envelope: ApiEnvelope<unknown>,
): RawMarkerData[] {
  const data = envelope.data as Record<string, unknown>;
  const markers = (data.markers as unknown[]) ?? [];
  return markers.map((m) => {
    const raw = m as Record<string, unknown>;
    return {
      skkuId: raw.skkuId as number | undefined,
      lat: Number(raw.lat ?? 0),
      lng: Number(raw.lng ?? 0),
      campus: (raw.campus as string) ?? 'hssc',
      displayNo: (raw.displayNo as string) ?? undefined,
      text: raw.text
        ? {
            ko: ((raw.text as Record<string, unknown>).ko as string) ?? '',
            en: ((raw.text as Record<string, unknown>).en as string) ?? '',
          }
        : undefined,
    };
  });
}

export function parsePolylineData(
  envelope: ApiEnvelope<unknown>,
): PolylineCoord[] {
  const data = envelope.data as Record<string, unknown>;
  const coords = (data.coords as number[][]) ?? [];
  return coords.map(([lat, lng]) => [lat, lng] as PolylineCoord);
}
