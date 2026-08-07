/**
 * Campus screen — Naver Map + snapping sheet + floating controls.
 *
 * Composition:
 *   CampusNaverMap (absoluteFill, behind sheet)
 *     ├─ MapMarkerLayer (per visible layer)
 *     └─ MapPolylineLayer (per visible polyline layer)
 *   SearchBar (absolute, top)
 *   CampusToggle (absolute, below search bar)
 *   FilterButton (absolute, below toggle)
 *   BottomSheet (snap: 15%/50%/83%)
 *     ├─ handleComponent={SheetHandle}
 *     └─ BottomSheetScrollView → SduiSectionList
 *   BuildingDetailSheet (modal, on marker tap)
 *   FilterSheet (modal, on filter button tap)
 *
 * Flutter source: lib/features/campus_map/ui/campus_map_tab.dart
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import type { NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import {
  useMapConfig,
  useCampusSections,
  useMapLayerStore,
  useEventMap,
  useEventMapStore,
  SdsColors,
} from '@skkuverse/shared';
import { EventMapPinLayer } from '@/features/eventmap/EventMapPinLayer';
import { EventMapPeekSheet } from '@/features/eventmap/EventMapPeekSheet';
import { SduiSectionList } from '@/sdui/renderer';
import { CampusSkeleton } from '@/sdui/widgets/CampusSkeleton';
import { CampusNaverMap } from './components/CampusNaverMap';
import { MapMarkerLayer } from './components/MapMarkerLayer';
import { MapPolylineLayer } from './components/MapPolylineLayer';
import { SearchBar } from './components/SearchBar';
import { CampusToggle } from './components/CampusToggle';
import { FilterSheet } from './components/FilterSheet';
import { SheetHandle } from './components/SheetHandle';
import { BuildingDetailSheet } from '@/features/building/components/BuildingDetailSheet';
import { useMapNavStore } from '@/features/search/store';
import { pendingMapPlaceLink } from '@/lib/pending-map-place-link';
import { logMarkerTap, logConnectionTap } from '@/services/analytics';

// 이 자리에 하드코딩 그리드(CAMPUS_GRID_ITEMS)가 있었다. `useCampusSections()`가
// 서버 button_grid를 이미 받아오는데도 `s.type !== 'button_grid'`로 걸러 버리고
// 하드코딩 사본을 대신 그렸다 — 그래서 서버가 건물지도를 네이티브 지도(route
// `/map/hssc`)로 바꾼 뒤에도 클라는 죽은 webview 지도를 계속 열었다.
// 이제 서버 섹션을 그대로 렌더한다: 항목·URL·순서의 SSOT는 서버 하나뿐이다.
// (`useCampusSections`는 절대 throw하지 않고 실패 시 DEFAULT_CAMPUS_SECTIONS를
// 주므로, 그리드가 비는 경우는 없다.)

/**
 * How long a place deep link waits for the event map snapshot before giving up.
 * Named rather than inlined because the number encodes a judgement: congested
 * festival wifi on an uncached first run regularly exceeds 10s.
 */
const PLACE_LINK_ABANDON_MS = 20_000;

export function CampusScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<NaverMapViewRef>(null);
  const detailSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const peekSheetRef = useRef<BottomSheetModal>(null);

  // ── Data ──
  const { data: mapConfig } = useMapConfig();
  const {
    data: campusData,
    isLoading: campusLoading,
  } = useCampusSections();

  // ── Store ──
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
  const layers = useMapLayerStore((s) => s.layers);
  const initFromConfig = useMapLayerStore((s) => s.initFromConfig);
  const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);

  // ── Building detail state ──
  const [selectedSkkuId, setSelectedSkkuId] = useState<number | null>(null);
  const [highlightSpaceCd, setHighlightSpaceCd] = useState<string | undefined>();
  const [buildingSource, setBuildingSource] = useState<string>('marker');
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);

  // ── Sheet snap points ──
  const snapPoints = useMemo(() => ['30%', '50%', '85%'], []);

  // ── Init layers from config ──
  useEffect(() => {
    if (mapConfig) {
      initFromConfig(mapConfig.layers);
    }
  }, [mapConfig, initFromConfig]);

  // ── Event map ──
  const eventMap = useEventMap();
  const setSelectedStackKey = useEventMapStore((s) => s.setSelectedStackKey);
  const selectedStackKey = useEventMapStore((s) => s.selectedStackKey);
  const selectedStack =
    eventMap.stacks.find((s) => s.stackKey === selectedStackKey) ?? null;

  // A stackKey can disappear mid-session — the server can flip stackKeyBy from
  // placeId to zone to thin out a crowded plaza, which re-keys every stack. An
  // empty sheet is worse than no sheet.
  useEffect(() => {
    if (selectedStackKey && !selectedStack) peekSheetRef.current?.dismiss();
  }, [selectedStackKey, selectedStack]);

  // The snapshot pins one campus (nsc for ESKARA), so switching campus must hide
  // the pins — and must do so with zero network, which is the whole reason the
  // snapshot ships structure and items together.
  const eventStacks =
    eventMap.snapshot && eventMap.snapshot.campus === selectedCampus ? eventMap.stacks : [];

  /**
   * Base-map visibility with the event's override applied ON TOP, derived per
   * render and never written to a store.
   *
   * The override normally hides 건물번호 while leaving 건물이름 up, so event pins
   * are legible without stripping the map of orientation. Deriving it rather
   * than forcing-then-restoring matters: a restore that never runs — app killed,
   * activation flipped — would leave the user's building-number layer off
   * permanently, with nothing on screen to explain why. Derived, the override
   * simply stops existing when the event does.
   */
  const basemapOverride = eventStacks.length > 0 ? (eventMap.snapshot?.basemapOverride ?? {}) : {};

  // ── Camera move on campus switch ──
  useEffect(() => {
    if (!mapConfig) return;
    const campus = mapConfig.campuses.find((c) => c.id === selectedCampus);
    if (!campus) return;
    mapRef.current?.animateCameraTo({
      latitude: campus.centerLat,
      longitude: campus.centerLng,
      zoom: campus.defaultZoom,
      duration: 500,
    });
  }, [selectedCampus, mapConfig]);

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
      if (p) setPendingNavPayload({ kind: 'place', placeId: p.placeId });
    };
    tryConsume(); // cold start: set before this tree existed
    return pendingMapPlaceLink.subscribe(tryConsume); // warm start
  }, [setPendingNavPayload]);

  useEffect(() => {
    if (!pendingPayload) return;
    const payload = clearPendingNavPayload();
    if (!payload) return;

    // A 'place' payload carries only an id; its coordinates live in the event
    // map snapshot, which a cold-start deep link can easily beat. Held until the
    // snapshot settles, then resolved below.
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
        mapRef.current?.animateCameraTo({
          latitude: payload.lat,
          longitude: payload.lng,
          zoom: 17.5,
          duration: 500,
        });
      }, 100);
    }

    // 3. Open building detail after camera settles
    setBuildingSource('search');
    setSelectedSkkuId(payload.skkuId);
    setHighlightSpaceCd(payload.highlightSpaceCd);
    setTimeout(() => {
      detailSheetRef.current?.present();
    }, 400);
  }, [pendingPayload, clearPendingNavPayload, selectedCampus, setSelectedCampus]);

  // ── Resolve a place deep link, once the snapshot has actually settled ──
  useEffect(() => {
    if (!pendingPlaceId) return;

    // Abandon rather than fire late. Offline with no cache means isSettled may
    // never arrive, and without this the camera would yank minutes later when
    // the network came back — long after the user moved on. Congested festival
    // wifi on a first run regularly exceeds 10s, so this is generous; MMKV
    // restore is instant, so it only governs the cold, uncached path.
    const abandon = setTimeout(() => setPendingPlaceId(null), PLACE_LINK_ABANDON_MS);
    if (!eventMap.isSettled) return () => clearTimeout(abandon);
    clearTimeout(abandon);

    setPendingPlaceId(null); // one shot, resolvable or not
    const stack = eventMap.stacksByPlaceId.get(pendingPlaceId);
    // An id that matches nothing lands on the campus tab with no sheet. That is
    // the documented behaviour, not a swallowed error.
    if (!stack) return;

    const snapshotCampus = eventMap.snapshot?.campus;
    if (snapshotCampus && snapshotCampus !== selectedCampus) {
      setSelectedCampus(snapshotCampus);
    }
    // Same 100ms → camera(500ms) → 400ms → present choreography as the search
    // handoff, so this screen has one such sequence rather than two.
    setTimeout(() => {
      mapRef.current?.animateCameraTo({
        latitude: stack.lead.lat,
        longitude: stack.lead.lng,
        zoom: 17.5,
        duration: 500,
      });
    }, 100);
    setSelectedStackKey(stack.stackKey);
    setTimeout(() => {
      peekSheetRef.current?.present();
    }, 400);
  }, [
    pendingPlaceId,
    eventMap.isSettled,
    eventMap.stacksByPlaceId,
    eventMap.snapshot?.campus,
    selectedCampus,
    setSelectedCampus,
    setSelectedStackKey,
  ]);

  // ── Marker tap ──
  const handleMarkerTap = useCallback((skkuId: number) => {
    logMarkerTap(skkuId);
    setBuildingSource('marker');
    setSelectedSkkuId(skkuId);
    setHighlightSpaceCd(undefined);
    detailSheetRef.current?.present();
  }, []);

  // ── Event pin tap ──
  const handleSelectStack = useCallback(
    (stackKey: string) => {
      setSelectedStackKey(stackKey);
      peekSheetRef.current?.present();
    },
    [setSelectedStackKey],
  );

  const handlePeekDismiss = useCallback(() => {
    setSelectedStackKey(null);
  }, [setSelectedStackKey]);

  // ── Connection tap (from building detail) ──
  const handleConnectionTap = useCallback((targetSkkuId: number) => {
    if (selectedSkkuId != null) logConnectionTap(selectedSkkuId, targetSkkuId);
    setBuildingSource('connection');
    setSelectedSkkuId(targetSkkuId);
    setHighlightSpaceCd(undefined);
    // Sheet is already open, just switch building
  }, [selectedSkkuId]);

  return (
      <View style={styles.root}>
        {/* Map (behind everything) */}
        {mapConfig && (
          <CampusNaverMap
            ref={mapRef}
            mapConfig={mapConfig}
            selectedCampus={selectedCampus}
            style={StyleSheet.absoluteFill}
          >
            {mapConfig.layers.map((layer) => {
              // The event's override wins over the user's toggle while it is
              // active, and disappears with it. initFromConfig deliberately
              // preserves user toggles, so nothing here can un-hide a layer the
              // event asked to hide.
              const visible =
                basemapOverride[layer.id] ??
                layers[layer.id]?.visible ??
                layer.defaultVisible;
              if (!visible) return null;

              if (layer.type === 'polyline') {
                return <MapPolylineLayer key={layer.id} layer={layer} />;
              }
              return (
                <MapMarkerLayer
                  key={layer.id}
                  layer={layer}
                  selectedCampus={selectedCampus}
                  onMarkerTap={handleMarkerTap}
                />
              );
            })}
            {/* Sibling of the config-driven layers: the event map is a separate
                request precisely so a map-config failure cannot take it down,
                and vice versa. CampusNaverMap forwards children verbatim, so no
                change is needed there. */}
            <EventMapPinLayer
              stacks={eventStacks}
              icons={eventMap.snapshot?.icons ?? {}}
              onSelectStack={handleSelectStack}
            />
          </CampusNaverMap>
        )}

        {/* Floating controls — single row */}
        {mapConfig && (
          <View
            style={[styles.controlRow, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <SearchBar />
          </View>
        )}

        {/* Snapping bottom sheet with SDUI */}
        <BottomSheet
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          handleComponent={SheetHandle}
          index={0}
        >
          <BottomSheetScrollView style={styles.sheetContent}>
            {!mapConfig || campusLoading ? (
              <CampusSkeleton />
            ) : (
              <>
                <View style={styles.sheetTopToggleWrap}>
                  <CampusToggle campuses={mapConfig.campuses} />
                </View>
                {campusData && (
                  <View style={styles.gridWrap}>
                    <SduiSectionList sections={campusData.sections} />
                  </View>
                )}
              </>
            )}
          </BottomSheetScrollView>
        </BottomSheet>

        {/* Modal sheets */}
        {mapConfig && (
          <>
            <BuildingDetailSheet
              ref={detailSheetRef}
              skkuId={selectedSkkuId}
              highlightSpaceCd={highlightSpaceCd}
              source={buildingSource}
              onConnectionTap={handleConnectionTap}
            />
            <FilterSheet ref={filterSheetRef} mapConfig={mapConfig} />
          </>
        )}

        {/* Outside the mapConfig gate: the event map is a separate request so a
            map-config hiccup cannot take it down, and vice versa. */}
        <EventMapPeekSheet
          ref={peekSheetRef}
          stack={selectedStack}
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
  controlRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  sheetContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sheetTopToggleWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  gridWrap: {
    paddingTop: 8,
    paddingBottom: 16,
  },
});
