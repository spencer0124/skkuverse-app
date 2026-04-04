/**
 * HSSC Building Map — native SVG implementation.
 *
 * Renders the campus floor connection map with:
 * - Background images (extracted from SVG patterns) + vector SVG overlay
 * - Pinch-to-zoom / pan with gesture handler
 * - Tap-to-select building floors with hit testing
 * - Bottom floating info card with floor navigation
 * - Building centering via `?building=` route param
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import { HSSC_SVG_XML } from './data/HsscMapSvg';
import { IMAGE_LAYOUT, SVG_WIDTH, SVG_HEIGHT } from './data/ImageLayout';
import availableLines, { type LineEntry } from './data/AvailableLines';
import { BUILDING_CENTERS } from './data/BuildingCenters';
import {
  ZoomableContainer,
  type ZoomableContainerRef,
} from './components/ZoomableContainer';
import { PlaceInfoCard } from './components/PlaceInfoCard';

export function HsscMapScreen() {
  const zoomableRef = useRef<ZoomableContainerRef>(null);
  const params = useLocalSearchParams<{ building?: string }>();

  // ── State ──
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedInfo: LineEntry | null = useMemo(() => {
    if (!selectedId) return null;
    return (availableLines as Record<string, LineEntry>)[selectedId] ?? null;
  }, [selectedId]);

  // ── Building centering after layout is ready ──
  const handleReady = useCallback(() => {
    if (!params.building) return;
    const center = BUILDING_CENTERS[params.building];
    if (!center) return;
    const fitScale = zoomableRef.current?.getFitScale() ?? 0;
    if (fitScale <= 0) return;
    zoomableRef.current?.animateTo(center.cx, center.cy, fitScale * 1.5);
  }, [params.building]);

  // ── Tap handlers ──
  const handleElementTap = useCallback((elementId: string) => {
    setSelectedId(elementId);
  }, []);

  const handleBackgroundTap = useCallback(() => {
    setSelectedId(null);
  }, []);

  // ── Floor navigation (previous/next) ──
  const handlePreviousPress = useCallback(() => {
    if (!selectedInfo?.previousplace) return;
    const targetId = findIdByPlacename(selectedInfo.previousplace);
    if (targetId) setSelectedId(targetId);
  }, [selectedInfo]);

  const handleNextPress = useCallback(() => {
    if (!selectedInfo?.afterplace) return;
    const targetId = findIdByPlacename(selectedInfo.afterplace);
    if (targetId) setSelectedId(targetId);
  }, [selectedInfo]);

  const handleDismiss = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <View style={styles.root}>
      <ZoomableContainer
        ref={zoomableRef}
        contentWidth={SVG_WIDTH}
        contentHeight={SVG_HEIGHT}
        onElementTap={handleElementTap}
        onBackgroundTap={handleBackgroundTap}
        onReady={handleReady}
      >
        {/* Content at SVG native size — ZoomableContainer handles scaling */}
        <View style={{ width: SVG_WIDTH, height: SVG_HEIGHT }}>
          {/* Background images layer */}
          {IMAGE_LAYOUT.map((entry, i) => (
            <Image
              key={i}
              source={entry.source}
              style={{
                position: 'absolute',
                left: entry.x,
                top: entry.y,
                width: entry.width,
                height: entry.height,
              }}
              resizeMode="stretch"
            />
          ))}

          {/* SVG vector layer (transparent background, on top of images) */}
          <SvgXml
            xml={HSSC_SVG_XML}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </ZoomableContainer>

      {/* Info card (outside ZoomableContainer to avoid gesture conflicts) */}
      {selectedInfo && (
        <PlaceInfoCard
          info={selectedInfo}
          onPreviousPress={handlePreviousPress}
          onNextPress={handleNextPress}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
}

/**
 * Find an element ID by its placename (used for previous/next navigation).
 * Searches through all availableLines entries.
 */
function findIdByPlacename(placename: string): string | null {
  for (const [id, entry] of Object.entries(availableLines)) {
    if ((entry as LineEntry).placename === placename) return id;
  }
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
