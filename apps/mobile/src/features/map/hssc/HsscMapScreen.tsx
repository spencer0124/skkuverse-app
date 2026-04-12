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

/**
 * Downscale factor for the SvgXml vector overlay layout size.
 *
 * react-native-svg's Android `SvgView.onDraw()` allocates an offscreen bitmap
 * sized `view.width × view.height × density² × 4 bytes`. At the SVG's native
 * size (4257 × 3720 dp) on a high-density Samsung device (density ≈ 3.0) this
 * works out to ~570MB → fatal `Canvas: trying to draw too large bitmap`
 * crash observed in 3.5.0 (build 106) Crashlytics.
 *
 * Because `HSSC_SVG_XML` carries `viewBox="0 0 4257 3720"`, the rendered
 * layout size is independent of the path coordinate space. We rasterize at
 * 1/4 size (~36MB bitmap), then visually scale the wrapping View by 4× via
 * an RN transform — RN transforms do NOT affect layout size, so the SvgView's
 * backing bitmap stays at the small layout size.
 *
 * Hit-testing is unaffected: `findElementAtPoint` and `ZoomableContainer`'s
 * tap-coord inverse transform both operate in SVG viewBox coordinates, which
 * are still tied to the outer fixed-size content View.
 */
const SVG_DOWNSCALE = 4;

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

          {/* SVG vector layer (transparent background, on top of images).
              Rendered at 1/SVG_DOWNSCALE the layout size to keep the
              SvgView backing bitmap small (see SVG_DOWNSCALE comment),
              then scaled visually back to full size with a top-left
              anchored RN transform. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: SVG_WIDTH / SVG_DOWNSCALE,
              height: SVG_HEIGHT / SVG_DOWNSCALE,
              transformOrigin: '0% 0%',
              transform: [{ scale: SVG_DOWNSCALE }],
            }}
          >
            <SvgXml
              xml={HSSC_SVG_XML}
              width={SVG_WIDTH / SVG_DOWNSCALE}
              height={SVG_HEIGHT / SVG_DOWNSCALE}
            />
          </View>
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
