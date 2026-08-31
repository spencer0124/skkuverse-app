/**
 * Campus screen — Naver Map + snapping sheet + floating controls.
 *
 * Composition:
 *   CampusNaverMap (absoluteFill, behind sheet)
 *     ├─ MapMarkerLayer (per visible layer)
 *     └─ MapPolylineLayer (per visible polyline layer)
 *   CampusToggle (absolute, top — the row the search bar used to hold)
 *   FilterButton (absolute, right of the toggle)
 *   Sheet (detents: small / medium / large, small+medium overridden)
 *     ├─ backgroundComponent={SheetBackground}  (glass card ⇄ opaque sheet)
 *     ├─ handleComponent={SheetHandle}          (the grabber alone; no fill)
 *     └─ Sheet.ScrollView → SduiSectionList (the server's campus feed)
 *        ⇄ EventListPanel, while a chip has narrowed the map (the event list)
 *   BuildingDetailSheet (modal, on marker tap) ┐ the campus sheet steps aside
 *   EventMapPeekSheet (modal, booth tap / row) ┘ for these — `sheetHandoff.ts`
 *   FilterSheet (modal, on filter button tap — floats beside the campus card)
 *
 * Flutter source: lib/features/campus_map/ui/campus_map_tab.dart
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera, NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import { CrosshairSimpleIcon } from 'phosphor-react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import {
  useCampusSections,
  useMapConfig,
  useMapLayerStore,
  useSettingsStore,
  useLayerMarkers,
  useWindowClock,
  useEventMapStore,
  useT,
  findNarrowedChip,
  isLayerVisible,
  resolveChipGroupDefaults,
  resolveChipLayerVisibility,
  selectVisibleMarkers,
  sortPlaces,
  isFestivalLayer,
  withoutFestival,
  DEFAULT_CAMERA_DEFAULTS,
  SdsColors,
  type Campus,
  type MapChip,
  type MapChipCamera,
  type MarkerTap,
  type RawMarkerData,
} from '@skkuverse/shared';
import { SduiSectionList } from '@/sdui/renderer';
import { EventMapPeekSheet } from '@/features/eventmap/EventMapPeekSheet';
import { EventListPanel } from '@/features/eventmap/EventListPanel';
import { GlassIconButton, Sheet, SHEET_FLOAT_INSET, type SheetRef } from '@skkuverse/sds';
import { isFestivalUnlocked } from './festivalGate';
import { CampusNaverMap } from './components/CampusNaverMap';
import { MapMarkerLayer } from './components/MapMarkerLayer';
import { MapPolylineLayer } from './components/MapPolylineLayer';
import { CampusToggle } from './components/CampusToggle';
import { CampusChipRow } from './components/CampusChipRow';
import { ActiveChipStrip } from './components/ActiveChipStrip';
import { FilterSheet } from './components/FilterSheet';
import { FilterButton } from './components/FilterButton';
import {
  IDLE_HANDOFF,
  releaseHandoff,
  requestHandoff,
  sheetSettled,
  type SheetHandoff,
} from './utils/sheetHandoff';
import { HeadingLocateIcon } from './components/HeadingLocateIcon';
import { CampusSuggestionCard } from './components/CampusSuggestionCard';
import {
  MAP_CONTROL_HEIGHT,
  MAP_CONTROL_GAP,
} from './components/controlMetrics';
import { MapCompass } from './components/MapCompass';
import {
  resolveCampusSuggestion,
  type CampusSuggestion,
} from './utils/campusProximity';
import { moveCamera } from './utils/moveCamera';
import {
  useLocationTracking,
  isFacing,
  isTracking,
} from './hooks/useLocationTracking';
import { BuildingDetailSheet } from '@/features/building/components/BuildingDetailSheet';
import { useMapNavStore } from '@/features/search/store';
import { pendingMapPlaceLink } from '@/lib/pending-map-place-link';
import { openWebView } from '@/features/webview/open';
import {
  logMarkerTap,
  logConnectionTap,
  logCampusContentSelect,
  logCampusSwitch,
  type BuildingDetailSource,
} from '@/services/analytics';

// 시트 본문은 서버가 보내는 `sections` 배열을 그 순서대로 그린다. 앱에는
// 하드코딩된 사본이 없다 — 예전에 이 자리에 CAMPUS_GRID_ITEMS가 있어서 서버가
// 건물지도를 네이티브 지도로 바꾼 뒤에도 죽은 webview를 계속 열었다. 항목을
// 바꾸려면 서버에서 바꾼다.
//
// 서버 `/ui/home/campus`는 아직 `campus_buttons`(건물지도/건물코드/분실물/문의하기)를
// 보낸다. 홈 그리드가 이미 같은 항목을 들고 있으므로 이건 중복이고, 서버에서
// 프로모션 피드 섹션으로 교체하는 게 남은 작업이다. 앱은 무엇이 오든 그린다.
//
// 위젯을 늘리기 전에: 새로운 *배치*는 템플릿이지 위젯이 아니다. 정말 새로운
// *인터랙션*이 생겼을 때만 섹션 타입을 추가한다 — eventmap의 슬롯 방식
// (`packages/shared/src/types/eventmap.ts`)이 이 저장소의 선례다.

/**
 * How long a place deep link waits for the event markers before giving up.
 * Named rather than inlined because the number encodes a judgement: congested
 * festival wifi on an uncached first run regularly exceeds 10s.
 */
const PLACE_LINK_ABANDON_MS = 20_000;

/** Breathing room between the locate button and the sheet's top edge. */
const LOCATE_SHEET_GAP = 12;

/**
 * How long an explicit camera request stays answerable, in ms.
 *
 * Two things raise it: a locate press and a chip tap. Both are the user saying
 * "take me somewhere", so the settle each causes is an answer rather than
 * drift.
 *
 * Sized for the slower of the two — a locate press has to cover the camera
 * animation AND the first GPS fix — and short enough that a request whose
 * camera never produced a decision cannot silently claim a pan made a minute
 * later.
 */
const EXPLICIT_CAMERA_RESULT_WINDOW_MS = 6000;

/**
 * The two lower sheet detents, as percentages of the sheet's container.
 *
 * Numbers rather than the `'24%'` strings the sheet wants, because the locate
 * button needs the same values as arithmetic. Deriving the strings from the
 * numbers keeps one source; the reverse — parsing the strings back — would make
 * the sheet's config the source and the button's maths a mirror of it.
 *
 * (Percent, not a 0–1 fraction: `0.24 * 100` is 24.000000000000004 in binary
 * floating point, which would reach the sheet as a snap point string of that
 * literal width.)
 *
 * The TOP detent is not here, because it is not a percentage at all: it is
 * `large`, which `Sheet` resolves as the container's height less the top safe
 * area. See `sheetPosition` below.
 */
const SHEET_SNAP_PERCENTS = [24, 42] as const;

/** Gap between the top safe area and the campus toggle. */
const MAP_TOP_INSET_GAP = 6;

/**
 * Gap between the toggle row and the chip row below it.
 *
 * Deliberately wider than the gap above the toggle. The two are independent
 * bands rather than one cluster, and at an equal gap the chips read as a third
 * row of the toggle's own control set.
 */
const MAP_TOP_ROW_GAP = 10;

/**
 * Which snap the locate button stops following the sheet at — the middle one.
 *
 * An index into `SHEET_SNAP_PERCENTS` rather than a duplicated `50`, so changing
 * the middle snap moves the button's parking spot with it and there is no second
 * number to keep in sync.
 */
const LOCATE_ANCHOR_SNAP_INDEX = 1;

/**
 * Where the sheet goes when the event list appears in it — the middle detent.
 *
 * The same index as the locate anchor, for a different reason: enough sheet to
 * read a few rows, with the map still showing the pins the rows describe.
 * Someone who tapped 주점 wants the map, not a full-height list. Kept separate
 * from `LOCATE_ANCHOR_SNAP_INDEX` because they only happen to agree.
 */
const EVENT_LIST_SNAP_INDEX = 1;

export function CampusScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<NaverMapViewRef>(null);
  const sheetRef = useRef<SheetRef>(null);
  const detailSheetRef = useRef<SheetRef>(null);
  const filterSheetRef = useRef<SheetRef>(null);
  const peekSheetRef = useRef<SheetRef>(null);

  // ── Data ──

  /**
   * The client festival gate, applied ONCE, here.
   *
   * Everything festival-shaped is downstream of these two: the filter tiles, the
   * chip row, the pins, the `/map/markers/event` fetch each pin layer would
   * start, the event list that replaces the sheet's feed, and the peek sheet a
   * booth tap or a `?place=` link opens. Stripping the config at the point it
   * enters the screen is what removes all of them without a single
   * festival-aware branch further down — see `festivalGate.ts` for what decides,
   * and `packages/shared/src/map/festival.ts` for the filter.
   *
   * A second consumer of `useMapConfig` would NOT inherit this. There is none
   * today; one that appears has to opt in here or gate itself.
   */
  const festivalUnlocked = isFestivalUnlocked();

  const { data: rawMapConfig } = useMapConfig();
  const mapConfig = useMemo(
    () => (rawMapConfig && !festivalUnlocked ? withoutFestival(rawMapConfig) : rawMapConfig),
    [rawMapConfig, festivalUnlocked],
  );

  /**
   * The sheet's feed. Rendered in the server's order, and empty is a normal
   * answer — the defaults are empty on purpose, so a dead API and a server with
   * nothing to promote both land here as an empty card over the map.
   *
   * Behind the festival gate, which is why it is not fetched at all while that
   * is shut. The server still serves `campus_buttons` here — 건물지도, 건물코드,
   * 분실물, 문의하기 — and the home grid already carries all four, so an empty
   * card over the map is the better resting state than a duplicate of another
   * tab. Gating it on the same switch rather than deleting the call keeps the
   * feed one flip away for the day the server replaces those buttons with
   * something worth showing.
   *
   * No skeleton. `CampusSkeleton` exists but mimics a button grid, which is the
   * shape this surface is moving away from, and grey shimmer blocks on a
   * translucent card over a moving map read as breakage rather than loading.
   * The card is small and the query is cached for a minute, so the honest
   * loading state here is an empty card for one paint.
   */
  const { data: campusFeed } = useCampusSections({ enabled: festivalUnlocked });

  // ── Store ──
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
  const layers = useMapLayerStore((s) => s.layers);
  const initFromConfig = useMapLayerStore((s) => s.initFromConfig);
  const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);
  const setLayersVisible = useMapLayerStore((s) => s.setLayersVisible);

  // ── Building detail state ──
  const [selectedSkkuId, setSelectedSkkuId] = useState<number | null>(null);
  const [highlightSpaceCd, setHighlightSpaceCd] = useState<string | undefined>();
  const [buildingSource, setBuildingSource] = useState<BuildingDetailSource>('marker');
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);
  /** A `?place=skku_building:<id>` link, held until the sheet exists to open. */
  const [pendingBuildingId, setPendingBuildingId] = useState<number | null>(null);

  /**
   * The sheet's live top edge, in px from the top of this screen. `Sheet`
   * writes it every frame of a drag, which is what lets the locate button ride
   * the sheet instead of jumping between snap points — an `onChange`/index
   * listener would only fire at the ends and the button would lag the finger.
   *
   * Seeded with the window height rather than 0 so it starts just off the bottom
   * and settles upward. At 0 the first frame would park it against the top of
   * the screen, which reads as a flash in the wrong corner.
   */
  const { height: windowHeight } = useWindowDimensions();
  const sheetTop = useSharedValue(windowHeight);

  /**
   * The sheet's live detent, 0..2, fractional mid-drag.
   *
   * Seeded at 0 rather than -1: gorhom reports -1 until its first layout, and
   * the card should be floating from the first frame it is visible rather than
   * springing outward once layout lands.
   *
   * `animatedIndex` and `animatedPosition` are filled by two independent
   * reactions inside the sheet, so asking for this one cannot perturb the other
   * — which matters, because `sheetTop` is what the locate button rides.
   */
  const sheetIndex = useSharedValue(0);

  const { t, tpl } = useT();

  // Memoised: `useLocationTracking` depends on this object, and a fresh literal
  // each render would re-create its permission callback every time.
  const locationStrings = useMemo(
    () => ({
      deniedTitle: t('map.permission.deniedTitle'),
      deniedBody: t('map.permission.deniedBody'),
      openSettings: t('map.permission.openSettings'),
      cancel: t('common.cancel'),
    }),
    [t],
  );

  /**
   * Measured rather than taken from `useWindowDimensions`: the sheet's percentage
   * snaps resolve against ITS container, which is this screen's root view, and
   * that is not the window once safe areas and the tab bar are accounted for.
   * Using the window height would put the parking spot a tab bar's worth off.
   */
  const [sheetContainerHeight, setSheetContainerHeight] = useState(0);
  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    setSheetContainerHeight(e.nativeEvent.layout.height);
  }, []);

  /**
   * Where a modal sheet's card should stop, measured from the WINDOW's bottom
   * edge. One value for the filter, peek and building sheets.
   *
   * A modal is portalled out to the root and its container is the whole
   * window, while this screen's sheet floats inside the root view measured
   * just above. Restating the campus card's own bottom edge in the modal's
   * coordinates is what puts every card on one line, and it stays true whether
   * or not the tab bar takes a bite out of this screen — a constant picked to
   * look right would drift the moment either changed.
   */
  const modalCardBottomGap = useMemo(
    () =>
      sheetContainerHeight > 0
        ? windowHeight - sheetContainerHeight + SHEET_FLOAT_INSET
        : SHEET_FLOAT_INSET,
    [windowHeight, sheetContainerHeight],
  );

  // ── Sheet detents ──
  /**
   * `small / medium / large` with this screen's own numbers for the low two.
   *
   * The names are kept rather than replaced by raw percentages, because they
   * are what earns the sheet its surface: `large` is the detent that ATTACHES,
   * which is what turns the floating glass card into an opaque sheet. `Sheet`
   * resolves `large` itself as the container's height less the top safe area —
   * "just below the safe area" is not a fixed fraction of the screen, since the
   * top inset is 62 on this device and nearer 20 on one with no Dynamic Island.
   *
   * The low two are overridden because they are load bearing elsewhere:
   * `locateAnchorTop` below is computed from the same constant, so the sheet
   * reads it rather than owning it.
   */
  const sheetPosition = useMemo(
    () =>
      ({
        kind: 'expandable',
        detents: ['small', 'medium', 'large'],
        heights: {
          small: `${SHEET_SNAP_PERCENTS[0]}%`,
          medium: `${SHEET_SNAP_PERCENTS[1]}%`,
        },
      }) as const,
    [],
  );

  /**
   * Where the button stops. A snap percentage is the sheet's HEIGHT, so its top
   * edge sits at `container * (1 - percent/100)` — the inversion is the reason
   * this is computed rather than read off the snap array directly.
   */
  const locateAnchorTop =
    sheetContainerHeight * (1 - SHEET_SNAP_PERCENTS[LOCATE_ANCHOR_SNAP_INDEX] / 100);

  /**
   * The sheet's chrome is `Sheet`'s business now: `surface="glass"` plus a
   * `large` top detent is what asks for the crossfading card, and the side
   * inset, the grabber and the computed bottom edge all come with it. What
   * stays here is the measurement, because an inline sheet's container is this
   * screen's root view and only this screen can measure it.
   */

  // ── Handing the screen to a detail modal ──

  /**
   * Two sheets never stack. A detail modal asks for the screen through
   * `presentOverSheet`: the campus sheet goes down, the modal rises once gorhom
   * reports it closed, and `releaseSheet` — wired to the modal's `onDismiss` —
   * returns the sheet to the detent it left. The decisions are
   * `sheetHandoff.ts`'s, pure and tested; this holds the refs and makes the
   * calls. Refs rather than state: nothing here is rendered, and a re-render
   * per detent report would be a re-render of the whole map for nothing.
   *
   * The filter sheet does not go through this. It floats beside the campus
   * card by design, on the same bottom line.
   */
  const handoff = useRef<SheetHandoff>(IDLE_HANDOFF);
  const waitingModal = useRef<RefObject<SheetRef | null> | null>(null);

  const presentOverSheet = useCallback((modal: RefObject<SheetRef | null>) => {
    const { state, close, present } = requestHandoff(handoff.current);
    handoff.current = state;
    if (close) {
      waitingModal.current = modal;
      sheetRef.current?.close();
    }
    // `present` is optional on a SheetRef — an inline sheet has none — and
    // every modal this hands off to is a modal, so the call always lands.
    if (present) modal.current?.present?.();
  }, []);

  const handleSheetSettled = useCallback((index: number) => {
    const { state, present } = sheetSettled(handoff.current, index);
    handoff.current = state;
    if (present) {
      const modal = waitingModal.current;
      waitingModal.current = null;
      modal?.current?.present?.();
    }
  }, []);

  // Both, on purpose: `onChange` is the detent report the hand-off tracks, and
  // `onClose` is the one report that must not be missed. `sheetSettled` is
  // idempotent for a closed report, so hearing it twice presents once.
  const handleSheetChange = useCallback(
    (index: number) => handleSheetSettled(index),
    [handleSheetSettled],
  );
  const handleSheetClose = useCallback(() => handleSheetSettled(-1), [handleSheetSettled]);

  const releaseSheet = useCallback(() => {
    const { state, snapTo } = releaseHandoff(handoff.current);
    handoff.current = state;
    waitingModal.current = null;
    if (snapTo !== null) sheetRef.current?.snapToIndex(snapTo);
  }, []);

  const {
    mode: trackingMode,
    bearing: cameraBearing,
    permissionGranted,
    requestPermission,
    cameraCommand,
    commandCamera,
    getCurrentCamera,
    handleOptionChanged,
    handleCameraChanged,
    cycleMode,
    resetNorth,
  } = useLocationTracking(mapRef, locationStrings);

  /**
   * Camera settings for the moves this screen makes on its own.
   *
   * Server-driven, so a chip's camera and a marker-tap camera cannot disagree
   * about how close "close" is. These were three copies of `zoom: 17.5` and
   * `duration: 500` in this file. Identity is stable — React Query's structural
   * sharing keeps the object across refetches — so it is safe as a callback
   * dependency.
   */
  const cameraDefaults = mapConfig?.cameraDefaults ?? DEFAULT_CAMERA_DEFAULTS;

  /**
   * The screen's one camera mover.
   *
   * Every move goes through `moveCamera`, which picks between the imperative
   * method and the declarative prop because neither carries a whole camera —
   * `animateCameraTo` has no tilt or bearing, the `camera` prop has no
   * duration. The choice depends on the map's CURRENT attitude, which is why
   * this reads it at call time rather than closing over a value: a target that
   * is flat still needs the prop when the map is rotated, or the move arrives
   * still rotated and nothing reports it.
   */
  const moveTo = useCallback(
    (target: MapChipCamera) => {
      moveCamera(target, {
        current: getCurrentCamera(),
        animate: (arg) => mapRef.current?.animateCameraTo(arg),
        command: commandCamera,
      });
    },
    [commandCamera, getCurrentCamera],
  );

  // ── Campus suggestion: the camera and the toggle disagree ──

  const [suggestion, setSuggestion] = useState<CampusSuggestion | null>(null);
  /**
   * The suggestion the user waved away, as `campus:variant`.
   *
   * Identity rather than a boolean, so dismissing silences THIS suggestion and
   * not the feature: moving to a different campus, or crossing from "you are on
   * the other one" to "you are on neither", produces a new identity and the card
   * comes back. Session-only on purpose — it is a nudge, not a setting.
   */
  const dismissedSuggestion = useRef<string | null>(null);

  /**
   * Has the user picked a campus from the toggle this session?
   *
   * Once they have, the map stops volunteering campus suggestions on its own.
   * An explicit choice outranks an inference drawn from where the camera
   * drifted, and second-guessing it is how a helpful nudge turns into an
   * argument. A ref, and session-scoped on purpose: it is about this sitting,
   * not a preference to remember.
   *
   * It does NOT gate the locate button. Pressing that is its own explicit
   * request — a newer one — so its outcome still applies.
   */
  const userPickedCampus = useRef(false);

  /**
   * When an explicit camera request started, or null when none is outstanding.
   *
   * Raised by a locate press and by a chip tap. The settle either causes is not
   * an ordinary pan: it is the answer to "where am I" or to "show me the
   * stage", and arriving on a campus should simply switch to it rather than
   * ask. A chip's camera is server-authored and lands on a campus by
   * construction, so in practice this is what keeps a festival chip from being
   * followed by a card asking whether to switch to the campus it just took you
   * to.
   *
   * A timestamp, and NOT cleared by the first settle. Switching tracking on
   * makes the SDK emit an idle while the camera is still at the OLD position,
   * before it has moved anywhere — and at that moment the map and the toggle
   * usually still agree, so there is no decision to make. Consuming the flag
   * there dropped it before the real answer arrived, and the settle at the
   * user's actual position was then read as drift and silently ignored. So it
   * is consumed only once a settle produces a decision.
   *
   * The window is what stops a flag from outliving the press that set it: a
   * locate whose camera never leaves the campus it started on produces no
   * decision at all, and without an expiry that flag would sit there and turn
   * some later, unrelated pan into a silent campus switch.
   */
  const awaitingExplicitCameraResult = useRef<number | null>(null);

  const locateStyle = useAnimatedStyle(() => {
    // Follows the sheet down, parks on the way up. `max` because Y grows
    // downward: a sheet dragged BELOW the anchor has the larger `sheetTop` and
    // wins, while one dragged above it is clamped to the anchor and the button
    // holds its place instead of being pushed off the top of the map.
    //
    // Before the first layout `locateAnchorTop` is 0, which clamps nothing — the
    // button simply tracks the sheet until the real height arrives.
    const top = Math.max(sheetTop.value, locateAnchorTop);
    return {
      transform: [{ translateY: top - MAP_CONTROL_HEIGHT - LOCATE_SHEET_GAP }],
    };
  }, [locateAnchorTop]);

  // ── Init layers from config ──
  useEffect(() => {
    if (mapConfig) {
      initFromConfig(mapConfig.layers);
    }
  }, [mapConfig, initFromConfig]);

  // ── Event map ──
  //
  // There is no event-map request any more. The snapshot tier that carried
  // items, card templates and sorts was deleted server-side; a booth is an
  // ordinary marker on whatever `/map/config` lists as a festival layer's
  // endpoint, so the pins the map already fetches ARE the data the list and the
  // peek sheet render. One fetch, one cache entry, and no way for a list to
  // disagree with the pin beside it.
  //
  // The endpoint is read off the served layers rather than hardcoded: the route
  // is named for the mechanism, so next year's festival changes the layer set
  // and not the URL — and this build never has to know either.
  const eventEndpoint = useMemo(
    () => mapConfig?.layers.find(isFestivalLayer)?.endpoint ?? null,
    [mapConfig],
  );
  const eventQuery = useLayerMarkers(eventEndpoint ?? '', eventEndpoint !== null);
  const eventMarkers = useMemo(() => eventQuery.data ?? [], [eventQuery.data]);

  /**
   * A `now` that moves when a booth opens or closes.
   *
   * The list's pills and the pin ladder both read it, so they change together at
   * a boundary rather than one of them waiting for an unrelated re-render. It is
   * NOT shared with `MapMarkerLayer`, which arms its own on the same data — two
   * timers on one boundary is cheaper than lifting the marker query up here just
   * to pass a number down.
   */
  const now = useWindowClock(eventMarkers);

  const sortId = useEventMapStore((s) => s.sortId);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const setSelectedPlaceId = useEventMapStore((s) => s.setSelectedPlaceId);
  const selectedPlaceId = useEventMapStore((s) => s.selectedPlaceId);
  const syncLayerSet = useEventMapStore((s) => s.syncLayerSet);

  /** The live layer set, for keying the persisted sort. `chipGroupId` is its id. */
  const activeLayerSetId = useMemo(
    () => mapConfig?.layers.find(isFestivalLayer)?.chipGroupId ?? null,
    [mapConfig],
  );
  useEffect(() => {
    syncLayerSet(activeLayerSetId);
  }, [activeLayerSetId, syncLayerSet]);

  /**
   * placeId → place. Built from EVERY event marker rather than the listed ones,
   * so an open peek sheet survives a layer toggle that hides the booth being
   * read, and a `skkuverse://map?place=` link reaches a booth the current layers
   * hide.
   */
  const placesById = useMemo(() => {
    const map = new Map<string, RawMarkerData>();
    for (const m of eventMarkers) {
      if (m.tap?.kind === 'event') map.set(m.tap.placeId, m);
    }
    return map;
  }, [eventMarkers]);

  const selectedPlace = selectedPlaceId ? (placesById.get(selectedPlaceId) ?? null) : null;

  // A place can leave the set mid-session — ops deletes a cancelled booth, and
  // the marker route is only cached for a minute. An empty sheet is worse than
  // no sheet.
  useEffect(() => {
    if (selectedPlaceId && !selectedPlace) peekSheetRef.current?.dismiss?.();
  }, [selectedPlaceId, selectedPlace]);

  /**
   * Is the live event on the campus the toggle is showing?
   *
   * Read off the markers themselves now rather than a snapshot's `campus` field.
   * An activation is single-campus, so the first marker answers for all of them,
   * and an empty set answers "no event" — which is what `/map/markers/event`
   * returns outside the window.
   */
  const eventActive = eventMarkers.length > 0 && eventMarkers[0]!.campus === selectedCampus;

  // ── Camera move on campus switch ──

  /**
   * Frame a campus. Extracted because two callers need it and only one of them
   * is a state change: switching campus goes through the effect below, while
   * re-tapping the campus already selected changes nothing for the effect to
   * observe and so has to ask for the move directly.
   */
  const focusCampus = useCallback(
    (campusId: Campus) => {
      const campus = mapConfig?.campuses.find((c) => c.id === campusId);
      if (!campus) return;
      // `defaultTilt` and `defaultBearing` were parsed and then dropped here for
      // as long as they have existed, so framing a campus could never straighten
      // a map the user had rotated. Both are 0 today, so passing them makes
      // "frame this campus" mean north-up again — and makes the attitude the
      // server's to set, the same way a chip's is.
      moveTo({
        lat: campus.centerLat,
        lng: campus.centerLng,
        zoom: campus.defaultZoom,
        tilt: campus.defaultTilt,
        bearing: campus.defaultBearing,
        durationMs: cameraDefaults.campusFocus.durationMs,
      });
    },
    [mapConfig, moveTo, cameraDefaults],
  );

  /**
   * Set to skip exactly one run of the effect below.
   *
   * Only the `switch` suggestion sets it. Every other campus change — the
   * toggle, a place deep link, an event place — wants the camera to
   * follow, and that one does not: the camera is already on the campus being
   * switched to. A ref rather than state because it must not itself cause a
   * render; it is read by the effect the same tick the campus changes.
   */
  const suppressNextCampusFocus = useRef(false);

  // Covers every campus change, not just the toggle's: a place deep link and an
  // event place link both set the campus too, and each wants the camera to
  // follow.
  useEffect(() => {
    if (suppressNextCampusFocus.current) {
      suppressNextCampusFocus.current = false;
      return;
    }
    focusCampus(selectedCampus);
  }, [selectedCampus, focusCampus]);

  /**
   * Runs once per camera settle, never during a pan — see `onCameraIdle` on
   * `CampusNaverMap` for why that distinction carries the cost of this feature.
   */
  const handleCameraIdle = useCallback(
    (camera: Camera) => {
      if (!mapConfig) return;
      const next = resolveCampusSuggestion({
        cameraLat: camera.latitude,
        cameraLng: camera.longitude,
        campuses: mapConfig.campuses,
        selectedCampus,
      });
      const startedAt = awaitingExplicitCameraResult.current;
      const fromExplicitAction =
        startedAt !== null && Date.now() - startedAt < EXPLICIT_CAMERA_RESULT_WINDOW_MS;

      if (next === null) {
        // No decision to make, so the locate press is still unanswered — the
        // camera may not have arrived yet. Keep waiting while the window holds.
        if (!fromExplicitAction) awaitingExplicitCameraResult.current = null;
        // Agreement clears the dismissal too: the next disagreement is a new
        // situation, and holding the old silence through it would be a bug the
        // user cannot see the cause of.
        dismissedSuggestion.current = null;
        setSuggestion(null);
        return;
      }

      // A decision is being made, so whatever the press was going to answer, it
      // is answered now.
      awaitingExplicitCameraResult.current = null;

      if (fromExplicitAction) {
        // Arriving on a campus is not a question worth asking — the user just
        // said "show me where I am" or "show me the stage", and the answer is
        // that campus. Switch and say nothing.
        if (next.variant === 'switch') {
          // The camera is already where they asked to be; re-framing the
          // campus centre would undo the very move they asked for.
          suppressNextCampusFocus.current = true;
          setSelectedCampus(next.campus);
          logCampusSwitch(next.campus);
          setSuggestion(null);
          return;
        }
        // Outside both campuses: nothing to switch to silently, so offer the
        // nearest. Offered even after an explicit toggle pick, because this is
        // the answer to a request the user made a second ago.
        setSuggestion(next);
        return;
      }

      // Drift, not a request. An explicit toggle pick this session silences it.
      if (userPickedCampus.current) return;
      if (dismissedSuggestion.current === `${next.campus}:${next.variant}`) return;
      setSuggestion(next);
    },
    [mapConfig, selectedCampus, setSelectedCampus],
  );

  /**
   * Take the suggestion.
   *
   * `switch` moves the toggle alone. The camera is already on that campus, and
   * the effect above would re-frame it — pulling the map out from under someone
   * who has just positioned it, to show them what they were already looking at.
   * Suppressing that is the whole difference between the two variants.
   *
   * `show` is the opposite case: nothing on screen is a campus, so being taken
   * there IS the request. When the nearest campus is the one already selected,
   * no toggle change happens and the camera move is all of it.
   */
  const handleSuggestionAccept = useCallback(() => {
    if (!suggestion) return;
    const { campus, variant } = suggestion;
    setSuggestion(null);
    dismissedSuggestion.current = null;

    if (campus !== selectedCampus) {
      suppressNextCampusFocus.current = variant === 'switch';
      setSelectedCampus(campus);
      logCampusSwitch(campus);
      if (variant === 'switch') return;
      // `show` with a campus change: the effect fires and frames it. Nothing
      // more to do here.
      return;
    }
    focusCampus(campus);
  }, [suggestion, selectedCampus, setSelectedCampus, focusCampus]);

  /**
   * Locate press, wrapped so the settle it causes can be told apart from a pan.
   *
   * The flag is raised BEFORE the await and lowered if tracking did not come on
   * — a refused permission produces no camera move, and a flag left standing
   * would make the next unrelated pan look like a locate result.
   */
  const handleLocatePress = useCallback(async () => {
    awaitingExplicitCameraResult.current = Date.now();
    const activated = await cycleMode();
    if (!activated) awaitingExplicitCameraResult.current = null;
  }, [cycleMode]);

  const handleSuggestionDismiss = useCallback(() => {
    if (!suggestion) return;
    dismissedSuggestion.current = `${suggestion.campus}:${suggestion.variant}`;
    setSuggestion(null);
  }, [suggestion]);

  /**
   * A campus pick from the toggle. The camera can leave the selected campus
   * without the toggle moving — locate is the ordinary way — which leaves
   * re-tapping the active segment as the natural "take me back", and that pick
   * carries no state change. Only a real switch is logged: a recentre is not a
   * campus switch, and counting it as one would inflate the metric.
   */
  const handleCampusPick = useCallback(
    (campusId: Campus) => {
      userPickedCampus.current = true;
      // A choice answers whatever the card was asking; leaving it up would have
      // it argue with the toggle the user has just set. It also outranks a
      // locate still waiting on its camera: the user has since said which
      // campus they want.
      awaitingExplicitCameraResult.current = null;
      setSuggestion(null);
      if (campusId === selectedCampus) {
        focusCampus(campusId);
        return;
      }
      setSelectedCampus(campusId);
      logCampusSwitch(campusId);
    },
    [selectedCampus, setSelectedCampus, focusCampus],
  );

  // ── Chips ──

  /**
   * The chip view the map is narrowed to, or null.
   *
   * Derived, never stored, so there is no second source of truth to drift: a
   * layer toggled in the filter sheet stops any chip describing the map, and the
   * answer survives a remount because it was never state. The "narrowed away
   * from the server's defaults" rule lives inside `findNarrowedChip` rather than
   * as a filter here — applied afterwards it would only be correct while there
   * is a single chip group.
   */
  const narrowedChip = useMemo(
    () => (mapConfig ? findNarrowedChip(mapConfig.chips, mapConfig.layers, layers) : null),
    [mapConfig, layers],
  );

  /**
   * A chip tap: go there, and set what should be on while looking.
   *
   * The visibility write is `resolveChipLayerVisibility`'s, not this file's,
   * because the rule is subtle enough to get wrong here: `layerIds` means
   * "within this group, set exactly these", so an unnamed sibling goes OFF while
   * every layer outside the group is left alone. Reading it as "turn these on"
   * would leave 주점 lit beside 공연; reading it as exclusive over everything
   * would turn 건물번호 off underneath.
   */
  const handleChipPress = useCallback(
    (chip: MapChip) => {
      logCampusContentSelect({ content_type: 'map_chip', item_id: chip.id });

      if (chip.action.kind === 'webview') {
        // The server ships no title beside the URL, deliberately: a page a chip
        // opened is titled by that chip, and a second string would be one more
        // thing to keep in step for no reachable difference.
        openWebView({ url: chip.action.url, title: chip.label });
        return;
      }

      if (mapConfig) {
        const next = resolveChipLayerVisibility(chip, mapConfig.layers);
        if (next) setLayersVisible(next);
      }

      // Marked before the move, so the settle it causes is read as the answer to
      // an explicit request rather than as drift — which is what switches the
      // campus toggle silently instead of asking.
      awaitingExplicitCameraResult.current = Date.now();
      moveTo(chip.action.camera);
    },
    [mapConfig, setLayersVisible, moveTo],
  );

  /**
   * Leave the narrowed view.
   *
   * Restores the group to each layer's own `defaultVisible` rather than to any
   * chip's `layerIds`, so 편의시설 — which ships hidden — goes back to hidden,
   * and a group whose reset chip was never served still has a way out.
   *
   * No camera move. The user is already looking where they want to be, and
   * widening a layer set is not a request to be taken somewhere else.
   */
  const handleChipClear = useCallback(() => {
    if (!narrowedChip || !mapConfig) return;
    const next = resolveChipGroupDefaults(narrowedChip, mapConfig.layers);
    if (next) setLayersVisible(next);
  }, [narrowedChip, mapConfig, setLayersVisible]);

  // ── The event list in the sheet ──

  /**
   * What the campus sheet shows: the event list while a chip has narrowed the
   * map, the server's campus feed otherwise.
   *
   * Narrowed, not merely "an event is on": the feed is the sheet's resting
   * content, and a chip tap is the moment the user asks what is in the view
   * they just chose. The reset chip restores the group's defaults, which
   * `findNarrowedChip` reads as narrowed to nothing — so it flies to the
   * festival and lights its pins but leaves the feed in place. `eventActive`
   * keeps the list off a campus the event is not on: the toggle can be flipped
   * away while the festival layers stay narrowed.
   */
  const showEventList = narrowedChip !== null && eventActive;

  /**
   * The layer ids whose markers compete for a coordinate: the FESTIVAL layers
   * currently drawn.
   *
   * Computed here rather than inside `MapMarkerLayer` because only this screen
   * holds both halves — which layers exist, and which the user has left on. The
   * building layers are excluded by `isFestivalLayer` for a reason worth
   * restating: they draw one building twice on purpose, a number and a name at
   * one point from records sharing an `id`, which the ladder would read as a
   * total tie and resolve by suppressing one of them.
   */
  const collisionPeers = useMemo(
    () =>
      new Set(
        (mapConfig?.layers ?? [])
          .filter((l) => isFestivalLayer(l) && isLayerVisible(l, layers))
          .map((l) => l.id),
      ),
    [mapConfig, layers],
  );

  /**
   * The list's rows: the places whose layer is drawn, in the active sort.
   *
   * `selectVisibleMarkers` reads the same `isLayerVisible` the render loop below
   * does — deliberately not a second copy — so a row is listed exactly when its
   * layer is drawn. A place the pin ladder suppressed for a shared coordinate
   * still gets a row: that ladder answers which pin is drawn there, not whether
   * the place exists.
   */
  const listedPlaces = useMemo(
    () =>
      mapConfig
        ? sortPlaces(
            selectVisibleMarkers({
              markers: eventMarkers,
              layers: mapConfig.layers,
              states: layers,
            }),
            sortId,
            appLanguage,
            now,
          )
        : [],
    [mapConfig, eventMarkers, layers, sortId, appLanguage, now],
  );

  // When the list appears, bring the sheet up to the middle detent — enough to
  // read it, with the map still showing the pins it describes. An effect on the
  // derived flag rather than a call inside the chip handler, so narrowing
  // through the filter sheet's tiles gets the same reveal, and the reset chip,
  // whose result is "not narrowed", gets none. Not while a modal has the
  // screen: the chips stay reachable above a peek sheet, and raising the
  // campus sheet under it would stack the two — the hand-off restores it.
  useEffect(() => {
    if (showEventList && handoff.current.restoreTo === null) {
      sheetRef.current?.snapToIndex(EVENT_LIST_SNAP_INDEX);
    }
  }, [showEventList]);

  // ── Pending map navigation (search, and `skkuverse://map?place=<id>`) ──
  const pendingPayload = useMapNavStore((s) => s.pendingNavPayload);
  const clearPendingNavPayload = useMapNavStore((s) => s.clearPendingNavPayload);
  const setPendingNavPayload = useMapNavStore((s) => s.setPendingNavPayload);

  // A place deep link becomes a second producer for the same store. No
  // root-layout consumer is needed the way notices and mini-apps have one:
  // redirectSystemPath already returned /(tabs)/campus, so this screen is
  // guaranteed mounted, and it is the only thing that can resolve a placeId.
  useEffect(() => {
    const tryConsume = () => {
      const p = pendingMapPlaceLink.consume();
      if (!p) return;
      // A building is resolvable on its own — `/building/:id` needs nothing but
      // the id — so it does not wait on the event markers the way a booth does.
      // A bare id (no prefix) keeps its historical meaning: an event place.
      if (p.kind === 'skku_building') {
        const skkuId = Number(p.placeId);
        if (Number.isFinite(skkuId)) setPendingBuildingId(skkuId);
        return;
      }
      setPendingNavPayload({ kind: 'place', placeId: p.placeId });
    };
    tryConsume(); // cold start: set before this tree existed
    return pendingMapPlaceLink.subscribe(tryConsume); // warm start
  }, [setPendingNavPayload]);

  useEffect(() => {
    if (!pendingPayload) return;
    const payload = clearPendingNavPayload();
    if (!payload) return;

    // A 'place' payload carries only an id; its coordinates live in the event
    // marker fetch, which a cold-start deep link can easily beat. Held until
    // the markers settle, then resolved below.
    if (payload.kind === 'place') {
      setPendingPlaceId(payload.placeId);
      return;
    }

    // 1. Switch campus if needed. Undefined means the producer could not say —
    //    a space search result has no campus — so leave the map where it is.
    if (payload.campus && payload.campus !== selectedCampus) {
      setSelectedCampus(payload.campus);
    }

    // 2. Animate camera
    if (payload.lat !== 0 && payload.lng !== 0) {
      setTimeout(() => {
        moveTo({ lat: payload.lat, lng: payload.lng, ...cameraDefaults.markerFocus });
      }, 100);
    }

    // 3. Open building detail after camera settles
    setBuildingSource('search');
    setSelectedSkkuId(payload.skkuId);
    setHighlightSpaceCd(payload.highlightSpaceCd);
    setTimeout(() => {
      presentOverSheet(detailSheetRef);
    }, 400);
  }, [
    pendingPayload,
    clearPendingNavPayload,
    selectedCampus,
    setSelectedCampus,
    moveTo,
    cameraDefaults,
    presentOverSheet,
  ]);

  // ── Resolve a building deep link, once there is a sheet to open ──
  // Gated on mapConfig because BuildingDetailSheet is rendered inside that gate,
  // and a cold-start link routinely beats the config request.
  useEffect(() => {
    if (pendingBuildingId == null || !mapConfig) return;
    setBuildingSource('direct');
    setSelectedSkkuId(pendingBuildingId);
    setHighlightSpaceCd(undefined);
    // Same 400ms as the search handoff: presenting a modal in the same frame the
    // screen mounts drops the animation.
    const timer = setTimeout(() => {
      presentOverSheet(detailSheetRef);
      // Cleared HERE and not before the timer, which is what makes this work at
      // all: `pendingBuildingId` is a dependency of this effect, so clearing it
      // up front re-runs the effect, and the previous run's cleanup then clears
      // the very timeout that was going to open the sheet. The link resolved,
      // the state advanced, and nothing appeared.
      setPendingBuildingId(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [pendingBuildingId, mapConfig, presentOverSheet]);

  // ── Resolve a place deep link, once the markers have actually settled ──
  //
  // `isFetched` rather than "has data": it is the only value that separates "no
  // event today", which is a decided answer worth abandoning on, from "the
  // request has not come back yet", which is worth waiting for. A disabled query
  // — the festival gate shut, or no festival layer served — never fetches, so it
  // counts as settled and the link is abandoned on the first pass.
  const eventSettled = eventEndpoint === null || eventQuery.isFetched;
  useEffect(() => {
    if (!pendingPlaceId) return;

    // Abandon rather than fire late. Offline on a cold start means `isFetched`
    // may take a while, and without this the camera would yank minutes later
    // when the network came back — long after the user moved on. Congested
    // festival wifi on a first run regularly exceeds 10s, so this is generous.
    const abandon = setTimeout(() => setPendingPlaceId(null), PLACE_LINK_ABANDON_MS);
    if (!eventSettled) return () => clearTimeout(abandon);
    clearTimeout(abandon);

    setPendingPlaceId(null); // one shot, resolvable or not
    const place = placesById.get(pendingPlaceId);
    // An id that matches nothing lands on the campus tab with no sheet. That is
    // the documented behaviour, not a swallowed error.
    if (!place) return;

    if (place.campus !== selectedCampus) setSelectedCampus(place.campus);
    // Same 100ms → camera(500ms) → 400ms → present choreography as the search
    // handoff, so this screen has one such sequence rather than two.
    setTimeout(() => {
      moveTo({ lat: place.lat, lng: place.lng, ...cameraDefaults.markerFocus });
    }, 100);
    setSelectedPlaceId(pendingPlaceId);
    setTimeout(() => {
      presentOverSheet(peekSheetRef);
    }, 400);
  }, [
    pendingPlaceId,
    eventSettled,
    placesById,
    selectedCampus,
    setSelectedCampus,
    setSelectedPlaceId,
    moveTo,
    cameraDefaults,
    presentOverSheet,
  ]);

  // ── Event pin tap ──
  const handleSelectPlace = useCallback(
    (placeId: string) => {
      setSelectedPlaceId(placeId);
      presentOverSheet(peekSheetRef);
    },
    [setSelectedPlaceId, presentOverSheet],
  );

  /**
   * A marker tap, routed on its own discriminator.
   *
   * `tap.placeId` is a string for every kind because one addressing scheme is
   * the point — a building and a booth are the same kind of thing (umbrella ADR
   * 0004 invariant 1). The narrowing back to a number happens here, inside the
   * building branch, because that is the only place that needs one:
   * `GET /building/:id` takes a numeric id.
   *
   * A booth resolves through `placesById`, built from ALL event markers rather
   * than the listed ones, so a tap always reaches the place it was drawn for. A
   * miss opens nothing — the same no-error behaviour the `?place=` deep link
   * already has.
   */
  const handleMarkerTap = useCallback(
    (tap: MarkerTap) => {
      switch (tap.kind) {
        case 'skku_building': {
          const skkuId = Number(tap.placeId);
          if (!Number.isFinite(skkuId)) return;
          logMarkerTap(skkuId);
          setBuildingSource('marker');
          setSelectedSkkuId(skkuId);
          setHighlightSpaceCd(undefined);
          presentOverSheet(detailSheetRef);
          return;
        }
        case 'event': {
          if (!placesById.has(tap.placeId)) return;
          handleSelectPlace(tap.placeId);
          return;
        }
      }
    },
    [placesById, handleSelectPlace, presentOverSheet],
  );

  // A list row is the same way into a pin that the pin itself is, plus the
  // camera: the row was chosen off a list, so the map has not been looked at
  // yet. Immediate on both counts — the deep-link path's staggered timeouts
  // exist because it may be switching campus first, and a row never is. The
  // peek sheet's low detent sits above the campus sheet's, so it covers the
  // list rather than stacking a second grab handle on it.
  const handleSelectFromList = useCallback(
    (place: RawMarkerData) => {
      moveTo({ lat: place.lat, lng: place.lng, ...cameraDefaults.markerFocus });
      // Every listed place is an event marker, so `tap` is non-null and carries
      // the place's own id. Falling back to `id` keeps this total anyway: the two
      // are the same string for an event marker.
      handleSelectPlace(place.tap?.placeId ?? place.id);
    },
    [moveTo, cameraDefaults, handleSelectPlace],
  );

  const handlePeekDismiss = useCallback(() => {
    setSelectedPlaceId(null);
    releaseSheet();
  }, [setSelectedPlaceId, releaseSheet]);

  // ── Connection tap (from building detail) ──
  const handleConnectionTap = useCallback((targetSkkuId: number) => {
    if (selectedSkkuId != null) logConnectionTap(selectedSkkuId, targetSkkuId);
    setBuildingSource('connection');
    setSelectedSkkuId(targetSkkuId);
    setHighlightSpaceCd(undefined);
    // Sheet is already open, just switch building
  }, [selectedSkkuId]);

  return (
      <View style={styles.root} onLayout={handleRootLayout}>
        {/* Map (behind everything) */}
        {mapConfig && (
          <CampusNaverMap
            ref={mapRef}
            mapConfig={mapConfig}
            selectedCampus={selectedCampus}
            style={StyleSheet.absoluteFill}
            onOptionChanged={handleOptionChanged}
            onCameraChanged={handleCameraChanged}
            onCameraIdle={handleCameraIdle}
            camera={cameraCommand}
          >
            {mapConfig.layers.map((layer) => {
              // The user's toggle, or the layer's own default. Nothing else gets
              // a say: an event used to be able to force a base-map layer to a
              // visibility from its snapshot, which made this a three-tier chain
              // every reader had to reproduce exactly. Event layers are ordinary
              // layers now.
              if (!isLayerVisible(layer, layers)) return null;

              if (layer.type === 'polyline') {
                return <MapPolylineLayer key={layer.id} layer={layer} />;
              }
              return (
                <MapMarkerLayer
                  key={layer.id}
                  layer={layer}
                  collisionPeers={collisionPeers}
                  onMarkerTap={handleMarkerTap}
                />
              );
            })}
            {/* Booth pins used to be drawn here, from a separate event
                snapshot, by a second marker component beside the config-driven
                layers. The server serves them as ordinary marker layers now, so
                the loop above draws them and a sibling would draw every booth
                twice — and that snapshot is gone entirely: the markers the loop
                fetches are also what the list and the peek sheet render. */}
          </CampusNaverMap>
        )}

        {/* Floating controls — campus row, then the event chip row beneath it.
            Gated on mapConfig only for the campus toggle, which needs the campus
            list; the event controls are gated on the SNAPSHOT instead, because
            the event map is deliberately independent of /map/config and a config
            hiccup must not take the chips down with it. */}
        <View
          style={[styles.controlColumn, { top: insets.top + MAP_TOP_INSET_GAP }]}
          pointerEvents="box-none"
        >
          <View style={styles.controlRow} pointerEvents="box-none">
            {mapConfig && (
              <CampusToggle campuses={mapConfig.campuses} onPick={handleCampusPick} />
            )}
            {mapConfig && (
              <FilterButton onPress={() => filterSheetRef.current?.present?.()} />
            )}
          </View>
          {/* The event map's chip row stood here and was removed: its chips
              filtered snapshot ITEMS, and the pins now come from
              /map/markers/event layers that such a chip cannot reach. This is
              its replacement, and it is a different contract — a map chip
              carries an ACTION and has no predicate at all.

              One slot, two states. Narrowing to a chip REPLACES the row with the
              strip naming it rather than stacking one above the other, so the
              band keeps a single row's height and the map's lower controls do
              not shift on every tap. The two share the metrics that make that
              true. */}
          {mapConfig &&
            (narrowedChip ? (
              <ActiveChipStrip
                chip={narrowedChip}
                onClear={handleChipClear}
                clearLabel={t('map.chip.clear')}
              />
            ) : (
              <CampusChipRow chips={mapConfig.chips} onPress={handleChipPress} />
            ))}
        </View>

        {/* The map's lower control row, riding the sheet. Mirrors the row at the
            top of the map: one stretch-width control beside one fixed circular
            button, both at `MAP_CONTROL_HEIGHT`. The suggestion card takes the
            width the locate button leaves, so the two sit on one line instead of
            the card pushing the button up a row.

            Anchored at `top: 0` and moved entirely by `translateY`, because a
            transform runs on the UI thread; animating `top` would round-trip
            through layout on every frame of a drag.

            Rendered before the sheet so the sheet wins if they ever overlap —
            they should not, since this sits a fixed gap above the sheet's edge,
            but the ordering makes a mis-measure degrade quietly. */}
        <Animated.View style={[styles.lowerControlRow, locateStyle]} pointerEvents="box-none">
          {/* Permission outranks any suggestion, and there is only one row. With
              location refused the map cannot show a position at all, so the
              locate button is inert and a campus suggestion would be advice the
              user has no way to act on. `null` means the first check has not
              landed yet — not a refusal — so nothing is shown for it. */}
          {permissionGranted === false ? (
            <CampusSuggestionCard
              message={t('map.campus.permission.message')}
              actionLabel={t('map.campus.permission.action')}
              onAccept={requestPermission}
            />
          ) : (
            suggestion && (
            <CampusSuggestionCard
              message={tpl(
                suggestion.variant === 'switch'
                  ? 'map.campus.suggest.switch'
                  : 'map.campus.suggest.show',
                suggestion.label,
              )}
              actionLabel={t(
                suggestion.variant === 'switch'
                  ? 'map.campus.suggest.actionSwitch'
                  : 'map.campus.suggest.actionShow',
              )}
              dismissLabel={t('map.campus.suggest.dismiss')}
              onAccept={handleSuggestionAccept}
              onDismiss={handleSuggestionDismiss}
            />
            )
          )}
          <View>
          {/* Absolutely positioned relative to the button rather than stacked
              above it in flow. The wrapper's box IS the button, so appearing and
              disappearing with `Face` cannot nudge the button, and the compass
              inherits the sheet-tracking transform for free. */}
          {isFacing(trackingMode) && (
            <View style={styles.compassSlot}>
              <MapCompass
                bearing={cameraBearing}
                onPress={resetNorth}
                label={t('map.compass')}
              />
            </View>
          )}
          <GlassIconButton
            label={isFacing(trackingMode) ? t('map.locate.face') : t('map.locate')}
            icon={
              isFacing(trackingMode) ? (
                <HeadingLocateIcon />
              ) : (
                <CrosshairSimpleIcon
                  size={20}
                  // Brand only while the camera is actually following. After a
                  // pan the SDK drops to NoFollow and this greys out on its own,
                  // via onOptionChanged — the dot stays, but the button stops
                  // claiming the map is tracking.
                  color={trackingMode === 'Follow' ? SdsColors.brand : SdsColors.grey700}
                  weight={isTracking(trackingMode) ? 'bold' : 'regular'}
                />
              )
            }
              onPress={handleLocatePress}
            />
          </View>
        </Animated.View>

        {/* Snapping bottom sheet: the campus feed, or the event list while a
            chip has narrowed the map. One body or the other, never both — a
            gorhom scrollable cannot nest inside another, and each registers
            itself with the sheet on mount, so the swap keeps the pan gesture. */}
        <Sheet
          ref={sheetRef}
          presentation="inline"
          position={sheetPosition}
          surface="glass"
          // Measured here rather than taken from the window: an inline sheet's
          // percentage detents resolve against ITS container, which is this
          // screen's root view, and that is not the window once the tab bar is
          // accounted for.
          containerHeight={sheetContainerHeight}
          animatedPosition={sheetTop}
          animatedIndex={sheetIndex}
          onChange={handleSheetChange}
          onClose={handleSheetClose}
        >
          {showEventList ? (
            <EventListPanel
              places={listedPlaces}
              now={now}
              onSelectPlace={handleSelectFromList}
            />
          ) : (
            /* The scroll view is what gives the sheet's body a content pane and
               keeps the content pan gesture, so a drag anywhere on the card
               still moves it. It stays mounted even when the feed is empty. */
            <Sheet.ScrollView
              style={styles.sheetContent}
              contentContainerStyle={styles.sheetFeed}
            >
              {/* Empty while the gate is shut, and the GATE is what says so —
                  not the disabled query. `enabled: false` stops refetching but
                  keeps whatever the cache already holds, so a session that
                  fetched before the gate closed would still render the feed.
                  The query gate saves the request; this one is the promise. The
                  scroll view stays mounted either way — it is what gives the
                  sheet its content pane and keeps the drag gesture. */}
              <SduiSectionList
                sections={festivalUnlocked ? (campusFeed?.sections ?? []) : []}
              />
            </Sheet.ScrollView>
          )}
        </Sheet>

        {/* Modal sheets */}
        {mapConfig && (
          <>
            <BuildingDetailSheet
              ref={detailSheetRef}
              skkuId={selectedSkkuId}
              highlightSpaceCd={highlightSpaceCd}
              source={buildingSource}
              bottomGap={modalCardBottomGap}
              onConnectionTap={handleConnectionTap}
              onDismiss={releaseSheet}
            />
            <FilterSheet
              ref={filterSheetRef}
              mapConfig={mapConfig}
              bottomGap={modalCardBottomGap}
            />
          </>
        )}

        {/* Outside the mapConfig gate: the event map is a separate request so a
            map-config hiccup cannot take it down, and vice versa. */}
        <EventMapPeekSheet
          ref={peekSheetRef}
          place={selectedPlace}
          now={now}
          bottomGap={modalCardBottomGap}
          onDismiss={handlePeekDismiss}
        />
      </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  // The absolute positioning moved up to the column so the chip row can sit
  // under the search row instead of beside it.
  controlColumn: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: MAP_TOP_ROW_GAP,
  },
  compassSlot: {
    position: 'absolute',
    right: 0,
    // The wrapper is exactly one button tall, so this clears its top edge by 8.
    bottom: MAP_CONTROL_HEIGHT + 8,
  },
  lowerControlRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    // `top: 0` plus a transform, not a computed `top`: see the note at the call
    // site. The row's own height is what `translateY` subtracts, so it lands
    // above the sheet rather than straddling it.
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    // Pushed right so the lone locate button keeps its corner when no card is
    // showing; the card's `flex: 1` is what claims the rest when one is.
    justifyContent: 'flex-end',
    gap: MAP_CONTROL_GAP,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  sheetContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheetFeed: {
    // 16 measured from the CARD's edge, not the screen's: the body carries the
    // animated inset, so this padding rides in with it and stays correct at
    // every detent. It is also the only horizontal gutter in the column — the
    // widgets deliberately carry none (see sdui/renderer.tsx).
    paddingHorizontal: 16,
    paddingTop: 8,
    // Clears the floating tab bar at the top detent, where the feed is the only
    // thing that scrolls. Matches HomeScreen's 32; confirm against a long feed
    // on device, since nothing here measures the bar.
    paddingBottom: 32,
  },
});
