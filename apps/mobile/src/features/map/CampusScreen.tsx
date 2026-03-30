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
  BottomSheetModalProvider,
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
import { FilterButton } from './components/FilterButton';
import { FilterSheet } from './components/FilterSheet';
import { SheetHandle } from './components/SheetHandle';
import { BuildingDetailSheet } from '@/features/building/components/BuildingDetailSheet';
import { useSearchResultStore } from '@/features/search/store';

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

  // ── Sheet snap points ──
  const snapPoints = useMemo(() => ['15%', '50%', '83%'], []);

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
    setSelectedSkkuId(payload.skkuId);
    setHighlightSpaceCd(payload.highlightSpaceCd);
    setTimeout(() => {
      detailSheetRef.current?.present();
    }, 400);
  }, [pendingPayload, clearPendingNavPayload, selectedCampus, setSelectedCampus]);

  // ── Marker tap ──
  const handleMarkerTap = useCallback((skkuId: number) => {
    setSelectedSkkuId(skkuId);
    setHighlightSpaceCd(undefined);
    detailSheetRef.current?.present();
  }, []);

  // ── Connection tap (from building detail) ──
  const handleConnectionTap = useCallback((targetSkkuId: number) => {
    setSelectedSkkuId(targetSkkuId);
    setHighlightSpaceCd(undefined);
    // Sheet is already open, just switch building
  }, []);

  // ── Filter button ──
  const handleFilterPress = useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  if (!mapConfig) {
    return <CampusSkeleton />;
  }

  return (
    <BottomSheetModalProvider>
      <View style={styles.root}>
        {/* Map (behind everything) */}
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

        {/* Floating controls */}
        <View
          style={[styles.searchBarContainer, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <SearchBar />
        </View>

        <View
          style={[styles.toggleContainer, { top: insets.top + 56 }]}
          pointerEvents="box-none"
        >
          <CampusToggle campuses={mapConfig.campuses} />
          <FilterButton onPress={handleFilterPress} />
        </View>

        {/* Snapping bottom sheet with SDUI */}
        <BottomSheet
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          handleComponent={SheetHandle}
          index={0}
        >
          <BottomSheetScrollView style={styles.sheetContent}>
            {campusLoading ? (
              <CampusSkeleton />
            ) : (
              campusData && (
                <SduiSectionList sections={campusData.sections} />
              )
            )}
          </BottomSheetScrollView>
        </BottomSheet>

        {/* Modal sheets */}
        <BuildingDetailSheet
          ref={detailSheetRef}
          skkuId={selectedSkkuId}
          highlightSpaceCd={highlightSpaceCd}
          onConnectionTap={handleConnectionTap}
        />

        <FilterSheet ref={filterSheetRef} mapConfig={mapConfig} />
      </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  searchBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  toggleContainer: {
    position: 'absolute',
    left: 0,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
