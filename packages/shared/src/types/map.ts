/**
 * Map configuration types — server-driven map layers, campuses, and markers.
 *
 * Flutter source: lib/features/campus_map/model/map_config.dart
 */


import type { Campus } from '../store/settings';
import type { ActionType } from './sdui';
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
  /** Pin width in points. Was MapMarkerLayer's PIN_WIDTH. */
  width?: number;
  /** Pin height in points. Was PIN_HEIGHT. */
  height?: number;
  /** Circle diameter in points. Was DOT_SIZE. */
  size?: number;
  captionTextSize?: number;
  /** Draw order against other overlays. Was the label layer's globalZIndex. */
  zIndex?: number;
}

export interface MapLayerDef {
  id: string;
  type: 'marker' | 'polyline';
  label: string;
  defaultVisible: boolean;
  endpoint: string;
  markerStyle?: 'numberCircle' | 'numberDot' | 'textLabel' | 'placeDot';
  style?: MapLayerStyle;
  /**
   * May the user change this layer's visibility.
   *
   * A separate axis from `defaultVisible`, which says what the value *is*:
   * this says *who may change it*. The four combinations give an always-on
   * background layer, an ordinary toggle, an opt-in, and a defined-but-inert
   * kill switch.
   *
   * **Absent means `true`.** Never fail closed — a server predating the field,
   * or a response that lost it, must not silently lock every control on the
   * map. It governs the affordance, not the capability: a locked layer still
   * renders, still fetches and is still deep-linkable, and the resolution stays
   * a fallback chain so a hidden control cannot destroy the stored preference
   * underneath it.
   */
  userConfigurable?: boolean;
  /**
   * Which exclusivity group a chip may swap this layer within, or `null` for a
   * layer no chip may ever change.
   *
   * **Not optional, and `null` is the meaningful value rather than an absence.**
   * A server predating the field parses to `null`, which fails in the safe
   * direction: an unknown layer is one no chip touches, so nothing is swapped
   * out from under the user.
   *
   * Declared by the server, never inferred from `endpoint`. The two agree today
   * — layers sharing a data source share a URL — but `endpoint` is a *cache*
   * key, so merging or splitting a route for network reasons would silently
   * redraw the chip boundaries, and the symptom would have no line of code to
   * blame.
   */
  chipGroupId: string | null;
}

// ── Chips (server-driven map actions) ──

/**
 * How a camera moves, with no target.
 *
 * Split from `MapChipCamera` because a chip and a marker-focus default want the
 * same four values and differ only in whether they carry their own coordinate:
 * a chip names where to go, `cameraDefaults.markerFocus` is applied to whatever
 * the user just tapped.
 *
 * The client cannot honour all four at once, and that is a limit of the map SDK
 * rather than of the schema — see `features/map/utils/moveCamera.ts`, which is
 * the one place that picks a mechanism.
 */
export interface MapCameraMotion {
  zoom: number;
  /** Degrees from vertical. 0 is straight down, which is the ordinary case. */
  tilt: number;
  /** Heading in degrees, 0 = north, clockwise. */
  bearing: number;
  durationMs: number;
}

/** A camera motion that names its own target. */
export interface MapChipCamera extends MapCameraMotion {
  lat: number;
  lng: number;
}

/**
 * Tagged, so a second icon kind (a remote image, an SF Symbol) can arrive
 * without the emoji case having to grow a discriminating field of its own.
 */
export type MapChipIcon = { kind: 'emoji'; emoji: string };

/**
 * What a chip tap resolves to.
 *
 * A chip answers "where should I be looking, and what should be on while I look
 * there", which is why it carries an action and a layer *set* rather than the
 * flat `actionType` + `actionValue: string` pair the home screen's SDUI uses:
 * that pair cannot carry a camera.
 */
export type MapChipAction =
  | { kind: 'webview'; url: string }
  | {
      kind: 'focus';
      camera: MapChipCamera;
      /**
       * The layers this chip switches ON, and — through their shared
       * `chipGroupId` — the set it switches OFF. **"Within this group, set
       * exactly these", not "turn these on".**
       *
       * An EMPTY array is the camera-only chip: no group resolves, so no
       * visibility changes. That is why this is not nullable — `[]` already
       * says it, and a second spelling for the same state is a second thing to
       * get wrong.
       *
       * The resolution lives in `map/chips.ts`, not at a call site.
       */
      layerIds: string[];
    };

export interface MapChip {
  id: string;
  /** Already localised, the way a layer label is. */
  label: string;
  /**
   * `null` is declared before it is reachable. Every chip served today carries
   * an emoji, but widening a non-nullable field later breaks every client
   * already narrowed to the non-null type, and a text-only chip is an ordinary
   * thing to want.
   */
  icon: MapChipIcon | null;
  action: MapChipAction;
}

/**
 * Camera settings for the moves the app makes on its own, as opposed to the
 * ones a chip asks for.
 *
 * These were constants repeated at three call sites in `CampusScreen`, which
 * meant a chip's camera and a marker-tap camera were configured in two
 * different places and could disagree about how close "close" is.
 */
export interface MapCameraDefaults {
  /** Focusing a tapped marker, a search result, or a deep link. */
  markerFocus: MapCameraMotion;
  /**
   * Switching campus. Only the duration lives here: the zoom, tilt and bearing
   * are per-campus and already sit on `CampusDef`.
   */
  campusFocus: { durationMs: number };
}

// ── Aggregate config from GET /map/config ──

export interface MapConfig {
  naver: NaverConfig;
  campuses: CampusDef[];
  layers: MapLayerDef[];
  /**
   * Chips ride inside this document rather than an endpoint of their own so a
   * chip's `layerIds` cannot disagree with the layer list on the wire — there
   * is no window in which the app holds fresh chips and stale layers.
   */
  chips: MapChip[];
  cameraDefaults: MapCameraDefaults;
}

// ── Marker data from layer endpoints ──

/**
 * What a marker tap resolves to, or `null` for a marker that is not interactive.
 *
 * `placeId` is a string for every kind, including a building whose id is numeric
 * in Mongo — one addressing scheme is the point, and the narrowing back to a
 * number happens in the building branch, where `GET /building/:id` needs one.
 *
 * This replaced a bare `skkuId?: number`, which could only ever address a
 * building.
 */
export type MarkerTap =
  | { kind: 'skku_building'; placeId: string }
  | { kind: 'event'; placeId: string };

/**
 * Every language the server holds, not the one matching `Accept-Language`.
 *
 * A building carries `{ko, en}` while an ops-authored booth title may also carry
 * `zh`, and the two producers share one schema — so resolving server-side would
 * mean picking one string and discarding the rest. `ko` is the source language
 * and always present; `en` has already fallen back to it upstream when nobody
 * wrote an English one.
 */
export interface I18nText {
  ko: string;
  en: string;
  zh?: string;
}

/**
 * One interval a place is open.
 *
 * **Both bounds are real, and half-bounded is not expressible.** That is the
 * server's rule, not a narrowing applied here: you write two windows, or none.
 * Allowing one open end would give the field a second way to say "no limit",
 * which is exactly the ambiguity that made a `status` field load-bearing before
 * — both-bounds-null had to mean an always-on 화장실 AND a rain-cancelled bar.
 */
export interface TimeWindow {
  startAt: string;
  endAt: string;
}

/** One card row, in authored order, carrying its own label. */
export interface MarkerField {
  label: I18nText;
  value: I18nText;
}

/**
 * One sheet button, in authored order.
 *
 * `actionValue` is complete by the time it ships: a `webview` value is authored
 * root-relative and resolved against the server's `WEBVIEW_ORIGIN` at serve
 * time, so the client only ever sees an absolute URL — a relative string handed
 * to a URL opener is the shape of an open redirect. `route` is the exception and
 * stays root-relative, because it reaches the app's own navigator.
 */
export interface MarkerAction {
  id: string;
  label: I18nText;
  actionType: ActionType;
  actionValue: string;
  style?: 'primary' | 'secondary';
}

export interface RawMarkerData {
  /**
   * Unique within its layer, NOT across layers: one building is drawn once per
   * building layer and both markers carry this same value. The React key is
   * therefore `layerId` plus this — see MapMarkerLayer.
   */
  id: string;
  /** Which layer draws this marker. Layers share endpoints, so this is the filter. */
  layerId: string;
  lat: number;
  lng: number;
  campus: Campus;
  /**
   * The string this marker displays — a building number, a building name, a
   * booth title. The layer's `markerStyle` decides how it is drawn, which is
   * why a separate `displayNo` no longer exists.
   *
   * Every language the server holds, not the one matching `Accept-Language`:
   * a building carries `{ko, en}` while an ops-authored booth title may also
   * carry `zh`, and resolving server-side would mean discarding the rest.
   */
  text: I18nText;
  /** What this marker is, under its name — a tenant, a department. `null` for every building. */
  subtitle: I18nText | null;
  /**
   * Every interval this place is open, in authored order. **Empty means always
   * open, and only that.**
   *
   * There is deliberately no `status` on the wire. It was only ever a cache of
   * `isOpenNow`, and caching it forced a single both-bounds-null pair to mean
   * two opposite things depending on a sibling field. A cancellation is
   * expressed by the marker not being served at all — a cancelled place is
   * deleted, not flagged — which is what frees `[]` to mean one thing.
   *
   * This replaced a scalar `startAt`/`endAt` pair. With one window per document
   * a booth open on both festival days had to be TWO documents, and the list
   * showed every place twice with nothing to tell the rows apart.
   */
  hours: TimeWindow[];
  /** Card rows in authored order. Empty for a building. */
  fields: MarkerField[];
  /** Sheet buttons in authored order. Empty for a building. */
  actions: MarkerAction[];
  /** Author's sort position, and the last tiebreak in a coordinate collision. Lower wins. */
  order: number;
  /** First step of the collision ladder, from the layer set's category table. Higher wins. `0` for a building. */
  pinPriority: number;
  tap: MarkerTap | null;
}

// ── Polyline data ──

export type PolylineCoord = [number, number]; // [lat, lng]
