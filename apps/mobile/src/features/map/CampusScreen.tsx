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
  SdsColors,
} from '@skkuverse/shared';
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
import { useSearchResultStore } from '@/features/search/store';
import { logMarkerTap, logConnectionTap } from '@/services/analytics';

// 이 자리에 하드코딩 그리드(CAMPUS_GRID_ITEMS)가 있었다. `useCampusSections()`가
// 서버 button_grid를 이미 받아오는데도 `s.type !== 'button_grid'`로 걸러 버리고
// 하드코딩 사본을 대신 그렸다 — 그래서 서버가 건물지도를 네이티브 지도(route
// `/map/hssc`)로 바꾼 뒤에도 클라는 죽은 webview 지도를 계속 열었다.
// 이제 서버 섹션을 그대로 렌더한다: 항목·URL·순서의 SSOT는 서버 하나뿐이다.
// (`useCampusSections`는 절대 throw하지 않고 실패 시 DEFAULT_CAMPUS_SECTIONS를
// 주므로, 그리드가 비는 경우는 없다.)

export function CampusScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<NaverMapViewRef>(null);
  const detailSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);

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

  // ── Sheet snap points ──
  const snapPoints = useMemo(() => ['30%', '50%', '85%'], []);

  // ── Init layers from config ──
  useEffect(() => {
    if (mapConfig) {
      initFromConfig(mapConfig.layers);
    }
  }, [mapConfig, initFromConfig]);

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

  // ── Search result navigation ──
  const pendingPayload = useSearchResultStore((s) => s.pendingNavPayload);
  const clearPendingNavPayload = useSearchResultStore(
    (s) => s.clearPendingNavPayload,
  );

  useEffect(() => {
    if (!pendingPayload) return;
    const payload = clearPendingNavPayload();
    if (!payload) return;

    // 1. Switch campus if needed
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

  // ── Marker tap ──
  const handleMarkerTap = useCallback((skkuId: number) => {
    logMarkerTap(skkuId);
    setBuildingSource('marker');
    setSelectedSkkuId(skkuId);
    setHighlightSpaceCd(undefined);
    detailSheetRef.current?.present();
  }, []);

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
              const layerState = layers[layer.id];
              if (!layerState?.visible) return null;

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
