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
  /**
   * The layer's PRIMARY paint, bare hex with no `#` — the convention
   * `toCssColor` expects.
   *
   * What it paints depends on the overlay it is drawing: a marker's tint, a
   * path's stroke, a polygon's fill. One field rather than a `fillColor`
   * beside it, because a layer carrying both would leave one of them dead on
   * every overlay it draws.
   */
  color?: string;
  /** A polygon's or path's outline. Ignored where there is no outline to draw. */
  outlineColor?: string;
  /**
   * Outline thickness in points.
   *
   * Not a nicety: `NaverMapPolygonOverlay` defaults it to ZERO, so an unstyled
   * zone has no border at all.
   */
  outlineWidth?: number;
  /**
   * Fill alpha, 0–1, composed into `color` as `#RRGGBBAA`.
   *
   * Also not a nicety, and in the same direction: the SDK's polygon `color`
   * defaults to OPAQUE BLACK, so a zone shipped without this is a dark blob
   * hiding the booths it exists to group. Kept separate from `color` rather
   * than widening the hex to eight digits, because an opacity is not a colour
   * and `color` is shared with the marker and path layers.
   */
  fillOpacity?: number;
  /**
   * Zoom bounds, passed to the SDK's `BaseOverlayProps` directly.
   *
   * A property of the LAYER rather than of any one overlay: building footprints
   * are noise at campus-wide zoom, and boundary lines are noise up close.
   */
  minZoom?: number;
  maxZoom?: number;
  /** Pin width in points. Was MapOverlayLayer's PIN_WIDTH. */
  width?: number;
  /** Pin height in points. Was PIN_HEIGHT. */
  height?: number;
  /** Circle diameter in points. Was DOT_SIZE. */
  size?: number;
  captionTextSize?: number;
  /** Draw order against other overlays. Was the label layer's globalZIndex. */
  zIndex?: number;
  /**
   * How a place marker draws unselected, and what it becomes when selected.
   *
   * **Absent means the client's default (`dotThenPin`), not `pin`.** A server
   * predating the field gets Naver's behaviour rather than the old always-a-pin
   * look, which is the point: the default is a client decision and the field is
   * only an override for a layer that wants something else.
   *
   * It lives here rather than as a fourth `markerStyle` member, and the failure
   * direction is the whole argument. An unrecognised `markerStyle` resolves to
   * `undefined` and falls through to the building-number branch, so a server
   * shipping a new member would make every older build draw booths as green
   * numbered circles. An unrecognised `shape` also resolves to `undefined`, but
   * there that reads as "the server did not say" and the client keeps its own
   * default. Additive and fail-safe in both directions.
   *
   * - `dotThenPin` — a small circle, promoted to a teardrop when selected.
   * - `dot` — a small circle either way, for a layer where a teardrop is too
   *   tall to sit in a dense strip.
   * - `pin` — a teardrop either way. The pre-2026-08 look.
   */
  shape?: MarkerShape;
}

/**
 * The shapes a place marker can take.
 *
 * A literal union rather than a string, so `asMember` can check it and every
 * `switch` over it is exhaustive. See `MapLayerStyle.shape`.
 */
export type MarkerShape = 'pin' | 'dot' | 'dotThenPin';

/**
 * One daily recurring window, in KST wall-clock `"HH:MM"`, half-open
 * `[start, end)`.
 *
 * Wall-clock rather than the absolute instants `TimeWindow` carries, and the two
 * are not interchangeable. A place's `hours` describe one booth on one festival
 * day; a layer's default says "주점 belongs to the evening", which is the same
 * sentence on every day of every festival. Written as instants that sentence
 * would restate the festival's dates in a second file, and a date slip touching
 * only one of them is silent.
 *
 * **`start > end` wraps past midnight**, which is what 주점 needs: `18:00`
 * → `00:00`. Midnight is `"00:00"` and the server rejects `"24:00"`, so there is
 * one spelling of it.
 */
export interface DailyWindow {
  start: string;
  end: string;
}

/**
 * WHEN a layer is on to begin with — the axis that replaced a plain
 * `defaultVisible: boolean`.
 *
 * A tagged union rather than a boolean beside a window list, because that pair
 * can hold combinations that mean nothing: `false` with windows is a flat
 * contradiction, `true` with windows makes the boolean dead data, and an empty
 * list is a second spelling of "no schedule". A layer on all day is
 * `{ kind: 'always' }`, which is the one spelling of that.
 *
 * The server never evaluates it. Windows ride in the payload and the device does
 * the arithmetic against its own clock, which is what keeps `/map/config` a
 * deterministic response.
 */
export type LayerDefaultVisibility =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'scheduled'; windows: DailyWindow[] };

export interface MapLayerDef {
  id: string;
  label: string;
  /**
   * When this layer is on, absent anything the user said.
   *
   * **`null` means the declaration was unreadable**, and it is deliberately a
   * third state rather than a coercion to `{ kind: 'never' }`. `never` is an
   * authoring choice — 편의시설 ships that way — while `null` is "this build
   * could not understand what the server said", and collapsing the two would
   * lose the ability to count the second. It resolves to OFF: see
   * `defaultVisibleAt` in `map/chips.ts` for why an unreadable rule must not
   * read as "on all day".
   */
  defaultVisibleWhen: LayerDefaultVisibility | null;
  endpoint: string;
  /**
   * How a MARKER on this layer is drawn. Ignored by every other overlay kind.
   *
   * There is deliberately no `type` beside it. A layer used to name its
   * renderer, which meant the renderer was chosen twice — once here and once by
   * the geometry — and the two could disagree with nothing to blame. An
   * overlay's own `kind` is now the single discriminant, which is also what
   * lets ONE layer draw pins, a zone and a route line together.
   */
  markerStyle?: 'numberCircle' | 'numberDot' | 'textLabel' | 'placeDot';
  style?: MapLayerStyle;
  /**
   * May the user change this layer's visibility.
   *
   * A separate axis from `defaultVisibleWhen`, which says *when* the layer is
   * on: this says *who may change it*. The four combinations give an always-on
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
  /**
   * Does this chip mean STOP NARROWING, rather than "show these layers".
   *
   * On the wire because it stopped being derivable. The reset chip used to be
   * recognisable by comparing what it names against the layers that are on by
   * default — and with `defaultVisibleWhen` that comparison depends on the time
   * of day, so at 19:00 the reset chip no longer describes the default view.
   * Reading a reset tap through the ordinary narrowing rule would set every
   * layer it names to on, turning 주점 on at noon, which is the crowding this
   * whole axis exists to remove.
   *
   * `action.layerIds` still says which GROUP the tap is scoped to, the way it
   * does for every chip; this says what the tap MEANS within it.
   */
  isReset: boolean;
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

/**
 * One position, axis-named.
 *
 * The wire carries GeoJSON positions, `[longitude, latitude]` — RFC 7946
 * §3.1.1, "precisely in that order". That tuple is renamed to this object in
 * exactly ONE place, `map/geometry.ts`, and nothing downstream ever sees the
 * array form. An axis swap raises no error — swapped Seoul coordinates land in
 * the Yellow Sea and the map lies quietly — so the defence is to have a single
 * conversion rather than to guard many. It is also why this is a named object
 * and not a tuple: `[number, number]` can be transposed by accident, and the
 * `PolylineCoord` this replaced was `[lat, lng]`, the reverse of the wire's.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Everything an overlay carries regardless of how it is drawn.
 *
 * Geometry is deliberately absent — it lives on the arms of `MapOverlay`,
 * because it is the one thing that differs between them. Everything here is the
 * same sentence about a place whether that place is a pin, a zone or a line.
 */
interface OverlayBase {
  /**
   * Unique within its layer, NOT across layers: one building is drawn once per
   * building layer and both overlays carry this same value. The React key is
   * therefore `layerId` plus this — see MapOverlayLayer.
   */
  id: string;
  /** Which layer draws this overlay. Layers share endpoints, so this is the filter. */
  layerId: string;
  campus: Campus;
  /**
   * The string this overlay displays — a building number, a building name, a
   * booth title, a zone name. The layer's `markerStyle` decides how a marker
   * draws it, which is why a separate `displayNo` no longer exists.
   *
   * Every language the server holds, not the one matching `Accept-Language`:
   * a building carries `{ko, en}` while an ops-authored booth title may also
   * carry `zh`, and resolving server-side would mean discarding the rest.
   */
  text: I18nText;
  /** What this is, under its name — a tenant, a department. `null` for every building. */
  subtitle: I18nText | null;
  /**
   * Every interval this place is open, in authored order. **Empty means always
   * open, and only that.**
   *
   * There is deliberately no `status` on the wire. It was only ever a cache of
   * `isOpenNow`, and caching it forced a single both-bounds-null pair to mean
   * two opposite things depending on a sibling field. A cancellation is
   * expressed by the overlay not being served at all — a cancelled place is
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
  /**
   * What a tap opens, or `null` for an overlay that is inert.
   *
   * `null` is how background geometry is expressed — a 통제 구간 outline that is
   * drawn and not pressable. A renderer must not wire `onTap` for it.
   */
  tap: MarkerTap | null;
}

/**
 * One drawable thing, tagged by HOW it is drawn.
 *
 * `kind` names the renderer rather than the geometry. That is what lets one
 * layer hold pins, a zone and a route line at once: a layer selects overlays by
 * `layerId`, and each overlay chooses its own component.
 *
 * **`kind` is an OPEN enum.** The server reserves `polyline`, `arrowheadPath`,
 * `circle`, `multiPath` and `groundImage`, and adding one is a non-breaking
 * server change *only while an unrecognised value is skipped*. So
 * `parseOverlayData` drops the single unknown overlay — never its layer, never
 * its siblings — and never asserts `never` over this union. That assertion is
 * precisely what would turn an additive server change into a blank layer on an
 * already-shipped build.
 *
 * Contract: skkuverse-server `docs/reference/map-overlays-api.md` §2.3.
 */
export type MapOverlay =
  | (OverlayBase & {
      kind: 'marker';
      /**
       * Flat scalars rather than a `LatLng`, and that is load-bearing.
       * `PinCandidate` destructures these two names, so the collision ladder in
       * `map/pins.ts` needs no change — and `tsc` then REFUSES to hand a
       * polygon to `resolvePinCollisions`, which makes scoping the ladder to
       * markers a compile error rather than a rule someone has to remember.
       */
      lat: number;
      lng: number;
      /**
       * A step of the collision ladder, resolved from the layer set's category
       * table. Higher wins. `0` for a building. Where it sits among the other
       * steps is `map/pins.ts`'s to state, not this file's.
       *
       * On this arm alone: two overlapping zones are a design choice, not a
       * collision to resolve, so the union makes the field unrepresentable on
       * the others rather than merely unused.
       */
      pinPriority: number;
    })
  | (OverlayBase & {
      kind: 'polygon';
      /**
       * `rings[0]` is the exterior ring; the rest are holes. Every ring is
       * closed — the last position repeats the first.
       *
       * Wound per RFC 7946 as it arrives: exterior counter-clockwise, holes
       * clockwise. The SDK wants the OPPOSITE, and that reversal belongs to the
       * renderer rather than here — see
       * `apps/mobile/src/features/map/utils/overlayGeometry.ts`.
       */
      rings: LatLng[][];
    })
  | (OverlayBase & {
      kind: 'path';
      /** The route's positions in order. At least two. */
      line: LatLng[];
    });

/**
 * The marker arm, for the code that genuinely only draws pins — the collision
 * ladder, the marker branches of the renderer.
 *
 * `Extract` rather than a restated interface, so widening `OverlayBase` cannot
 * leave the two out of step.
 */
export type MarkerOverlay = Extract<MapOverlay, { kind: 'marker' }>;

