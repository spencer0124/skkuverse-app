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
  type Camera,
  type LocationTrackingMode,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import type { ViewStyle, StyleProp } from 'react-native';
import type { MapConfig } from '@skkuverse/shared';
import { useSettingsStore } from '@skkuverse/shared';

interface CampusNaverMapProps {
  mapConfig: MapConfig;
  selectedCampus: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onTapMap?: () => void;
  /**
   * Fires whenever the SDK's own tracking mode changes — including the silent
   * downgrade to `NoFollow` it performs on any camera move. The locate button
   * mirrors this rather than its own taps; see `useLocationTracking`.
   */
  onOptionChanged?: (params: { locationTrackingMode: LocationTrackingMode }) => void;
  onCameraChanged?: (params: Camera) => void;
  /**
   * Fires when the camera settles, NOT while it moves — the SDK withholds it
   * until a gesture has fully ended and until an animation has completed. That
   * is what makes it the right hook for a decision about where the camera came
   * to rest: `onCameraChanged` fires every frame of a pan and would need
   * debouncing to answer the same question.
   */
  onCameraIdle?: (params: Camera) => void;
  /**
   * One-shot camera order, NOT controlled state. The map stays uncontrolled
   * between orders — this is the only route to the camera's bearing, which no
   * ref method exposes. See the note in `useLocationTracking`.
   */
  camera?: Camera;
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
  function CampusNaverMap(
    {
      mapConfig,
      selectedCampus,
      style,
      children,
      onTapMap,
      onOptionChanged,
      onCameraChanged,
      onCameraIdle,
      camera,
    },
    ref,
  ) {
    const lang = useSettingsStore((s) => s.appLanguage);
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
        // Stays off: the SDK's compass cannot be positioned (bare boolean, no
        // align prop), and this map's compass has to sit above the locate button
        // and ride the sheet. `MapCompass` draws it instead.
        isShowCompass={false}
        isExtentBoundedInKorea
        mapType="Basic"
        locale={lang}
        layerGroups={LAYER_GROUPS}
        {...(mapConfig.naver.styleId && {
          customStyleId: mapConfig.naver.styleId,
        })}
        onTapMap={onTapMap}
        onOptionChanged={onOptionChanged}
        onCameraChanged={onCameraChanged}
        onCameraIdle={onCameraIdle}
        {...(camera && { camera })}
      >
        {children}
      </NaverMapView>
    );
  },
);

export type { NaverMapViewRef };
