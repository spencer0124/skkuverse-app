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
  markerStyle?: 'numberCircle' | 'numberDot' | 'textLabel';
  style?: MapLayerStyle;
  /**
   * The chip group this layer belongs to, or `null` for a layer no chip may
   * change — the permanent building layers.
   *
   * This build reads it for one purpose: it is what separates festival content
   * from permanent campus furniture, and so what the client festival gate keys
   * on (`map/festival.ts`). The chips themselves are a later contract this
   * build does not have.
   *
   * **Not optional, and `null` is the meaningful value rather than an absence.**
   * A server predating the field parses to `null`, which fails in the safe
   * direction: an unrecognised layer is treated as permanent and kept, not
   * stripped from a map that would then be missing its buildings.
   */
  chipGroupId: string | null;
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
