/**
 * Map configuration types — server-driven map layers, campuses, and markers.
 *
 * Flutter source: lib/features/campus_map/model/map_config.dart
 */

// ── Naver Map config ──

export interface NaverConfig {
  styleId?: string;
}

// ── Campus definitions ──

export interface CampusDef {
  id: string; // "hssc" | "nsc"
  label: string; // "인사캠" | "자과캠"
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  defaultTilt: number;
  defaultBearing: number;
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
  markerStyle?: 'numberCircle' | 'textLabel';
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
  campus: string;
  displayNo?: string;
  text?: { ko: string; en: string };
}

// ── Polyline data ──

export type PolylineCoord = [number, number]; // [lat, lng]
