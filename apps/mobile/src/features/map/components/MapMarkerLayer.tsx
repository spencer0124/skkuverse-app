/**
 * Renders markers for a single map layer, filtered by selected campus.
 *
 * Three marker styles from MapLayerDef.markerStyle:
 * - numberCircle: circle icon + building number caption centered on icon
 * - textLabel: localized text, tiny dot, caption with collision hiding
 * - default: small dot marker, no caption
 *
 * Flutter source: MapLayerController._buildMarkersFromJson
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import { useLayerMarkers, type MapLayerDef, useSettingsStore } from '@skkuuniverse/shared';

const MARKER_ICON = require('../../../../assets/images/line_blank.png');

/**
 * Pure View/Text pin marker for numberCircle style.
 * iOS custom view markers use a one-shot UIView→UIImage snapshot (renderInContext).
 * <Image> loads async via SDWebImage → always misses the snapshot.
 * View/Text render synchronously → always captured correctly.
 */
const NumberCircleMarker = React.memo(function NumberCircleMarker({
  displayNo,
  markerSize,
}: {
  displayNo: string;
  markerSize: number;
}) {
  return (
    <View
      collapsable={false}
      style={[styles.numberMarker, { width: markerSize, height: markerSize }]}
    >
      <View style={styles.pinCircle}>
        <Text style={styles.numberText}>{displayNo}</Text>
      </View>
      <View style={styles.pinPoint} />
    </View>
  );
});

interface MapMarkerLayerProps {
  layer: MapLayerDef;
  selectedCampus: string;
  onMarkerTap: (skkuId: number) => void;
}

export function MapMarkerLayer({
  layer,
  selectedCampus,
  onMarkerTap,
}: MapMarkerLayerProps) {
  const { data: markers } = useLayerMarkers(layer.endpoint, true);
  const lang = useSettingsStore((s) => s.appLanguage);

  const filteredMarkers = useMemo(() => {
    if (!markers) return [];
    return markers.filter((m) => m.campus === selectedCampus);
  }, [markers, selectedCampus]);

  if (!filteredMarkers.length) return null;

  return (
    <>
      {filteredMarkers.map((marker, i) => {
        const key = `${layer.id}-${marker.skkuId ?? `${marker.lat}_${marker.lng}_${i}`}`;

        if (layer.markerStyle === 'textLabel') {
          const text =
            lang === 'en'
              ? marker.text?.en || marker.text?.ko || ''
              : marker.text?.ko || '';
          return (
            <NaverMapMarkerOverlay
              key={key}
              latitude={marker.lat}
              longitude={marker.lng}
              width={1}
              height={1}
              image={MARKER_ICON}
              caption={{
                text,
                textSize: layer.style?.captionTextSize ?? 7,
                color: 'black',
                requestedWidth: 200,
              }}
              isHideCollidedCaptions
              globalZIndex={100000}
              onTap={marker.skkuId != null ? () => onMarkerTap(marker.skkuId!) : undefined}
            />
          );
        }

        if (layer.markerStyle === 'numberCircle') {
          const markerSize = layer.style?.size ?? 25;
          return (
            <NaverMapMarkerOverlay
              key={key}
              latitude={marker.lat}
              longitude={marker.lng}
              width={markerSize}
              height={markerSize}
              anchor={{ x: 0.5, y: 1 }}
              onTap={marker.skkuId != null ? () => onMarkerTap(marker.skkuId!) : undefined}
            >
              <NumberCircleMarker
                displayNo={marker.displayNo ?? ''}
                markerSize={markerSize}
              />
            </NaverMapMarkerOverlay>
          );
        }

        // Default: small marker with icon, no caption
        const markerSize = layer.style?.size ?? 25;
        return (
          <NaverMapMarkerOverlay
            key={key}
            latitude={marker.lat}
            longitude={marker.lng}
            width={markerSize}
            height={markerSize}
            image={MARKER_ICON}
            onTap={marker.skkuId != null ? () => onMarkerTap(marker.skkuId!) : undefined}
          />
        );
      })}
    </>
  );
}

const PIN_COLOR = '#0A3D2C';

const styles = StyleSheet.create({
  numberMarker: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: PIN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: PIN_COLOR,
    marginTop: -1,
  },
  numberText: {
    fontSize: 7,
    color: 'black',
    fontWeight: '600',
  },
});
