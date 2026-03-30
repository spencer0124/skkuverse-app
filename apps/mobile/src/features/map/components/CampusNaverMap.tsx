/**
 * NaverMapView wrapper for the campus map.
 *
 * Accepts map config + selected campus to position camera.
 * Exposes ref for camera animation (search result navigation).
 *
 * Flutter source: lib/features/campus_map/ui/campus_map_tab.dart
 */

import { forwardRef, useMemo } from 'react';
import {
  NaverMapView,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import type { ViewStyle, StyleProp } from 'react-native';
import type { MapConfig } from '@skkuverse/shared';

interface CampusNaverMapProps {
  mapConfig: MapConfig;
  selectedCampus: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onTapMap?: () => void;
}

const HSSC_FALLBACK = {
  latitude: 37.587241,
  longitude: 126.992858,
  zoom: 15.8,
};

const LAYER_GROUPS = {
  BUILDING: true,
  TRANSIT: true,
  BICYCLE: false,
  CADASTRAL: false,
  MOUNTAIN: false,
  TRAFFIC: false,
} as const;

export const CampusNaverMap = forwardRef<NaverMapViewRef, CampusNaverMapProps>(
  function CampusNaverMap({ mapConfig, selectedCampus, style, children, onTapMap }, ref) {
    const campus = useMemo(() => {
      return (
        mapConfig.campuses.find((c) => c.id === selectedCampus) ??
        mapConfig.campuses[0]
      );
    }, [mapConfig.campuses, selectedCampus]);

    const initialCamera = useMemo(
      () => ({
        latitude: campus?.centerLat ?? HSSC_FALLBACK.latitude,
        longitude: campus?.centerLng ?? HSSC_FALLBACK.longitude,
        zoom: campus?.defaultZoom ?? HSSC_FALLBACK.zoom,
      }),
      // Only compute once — camera moves via ref after initial render
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    return (
      <NaverMapView
        ref={ref}
        style={style}
        initialCamera={initialCamera}
        isShowZoomControls={false}
        isShowScaleBar={false}
        isShowCompass={false}
        isExtentBoundedInKorea
        mapType="Basic"
        layerGroups={LAYER_GROUPS}
        {...(mapConfig.naver.styleId && {
          customStyleId: mapConfig.naver.styleId,
        })}
        onTapMap={onTapMap}
      >
        {children}
      </NaverMapView>
    );
  },
);

export type { NaverMapViewRef };
