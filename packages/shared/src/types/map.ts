/**
 * Map configuration types — server-driven map layers, campuses, and markers.
 *
 * Flutter source: lib/features/campus_map/model/map_config.dart
 */


import type { Campus } from '../store/settings';
// ── Naver Map config ──

export interface NaverConfig {
  styleId?: string;
}

// ── Campus definitions ──

export interface CampusDef {
  /** A comment listing the values used to stand here. The union is the comment. */
  id: Campus;
  label: string; // "인사캠" | "자과캠" — server-driven display text, genuinely open
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  defaultTilt: number;
  defaultBearing: number;
  /**
   * How far from the centre still counts as being on this campus, in metres.
   *
   * Optional because it is newer than the clients reading it: a build predating
   * the server field gets `undefined` and falls back to
   * `DEFAULT_CAMPUS_RADIUS_M`, and a server predating it sends nothing. Neither
   * side may assume the other has shipped.
   */
  radiusM?: number;
}

// ── Map layer definitions (server-driven) ──

export interface MapLayerStyle {
  color?: string; // hex without #
  outlineColor?: string;
  width?: number;
  size?: number;
  captionTextSize?: number;
}

export interface MapLayerDef {
  id: string;
  type: 'marker' | 'polyline';
  label: string;
  defaultVisible: boolean;
  endpoint: string;
  markerStyle?: 'numberCircle' | 'numberDot' | 'textLabel';
  style?: MapLayerStyle;
}

// ── Aggregate config from GET /map/config ──

export interface MapConfig {
  naver: NaverConfig;
  campuses: CampusDef[];
  layers: MapLayerDef[];
}

// ── Marker data from layer endpoints ──

export interface RawMarkerData {
  skkuId?: number;
  lat: number;
  lng: number;
  campus: Campus;
  displayNo?: string;
  text?: { ko: string; en: string };
}

// ── Polyline data ──

export type PolylineCoord = [number, number]; // [lat, lng]
