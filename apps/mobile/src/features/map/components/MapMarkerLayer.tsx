/**
 * Renders markers for a single map layer, filtered by selected campus.
 *
 * Four marker styles from MapLayerDef.markerStyle:
 * - numberDot: filled circle with number, building name caption (default)
 * - numberCircle: circle icon + pin point + building number caption
 * - textLabel: localized text, tiny dot, caption with collision hiding
 * - default: small dot marker, no caption
 *
 * Flutter source: MapLayerController._buildMarkersFromJson
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import { useLayerMarkers, type MapLayerDef, useSettingsStore, SdsColors } from '@skkuverse/shared';

const MARKER_ICON = require('../../../../assets/images/transparent_1x1.png');

const DOT_SIZE = 16;

const NumberDotMarker = React.memo(function NumberDotMarker({
  displayNo,
}: {
  displayNo: string;
}) {
  return (
    <View
      key={displayNo}
      collapsable={false}
      renderToHardwareTextureAndroid
      style={styles.dotMarker}
    >
      <Text style={styles.dotText}>{displayNo}</Text>
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

        // Default: numberDot (filled green circle with white number + building name caption)
        {
          const text =
            lang === 'en'
              ? marker.text?.en || marker.text?.ko || ''
              : marker.text?.ko || '';

          return (
            <NaverMapMarkerOverlay
              key={`${key}-${marker.displayNo}`}
              latitude={marker.lat}
              longitude={marker.lng}
              width={DOT_SIZE}
              height={DOT_SIZE}
              anchor={{ x: 0.5, y: 1.0 }}
              caption={{
                text,
                textSize: 9,
                color: '#333333',
                requestedWidth: 200,
                offset: 40,
              }}
              onTap={marker.skkuId != null ? () => onMarkerTap(marker.skkuId!) : undefined}
            >
              <NumberDotMarker displayNo={marker.displayNo ?? ''} />
            </NaverMapMarkerOverlay>
          );
        }
      })}
    </>
  );
}

const DOT_COLOR = SdsColors.brand;

const styles = StyleSheet.create({
  dotMarker: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    fontSize: 7,
    fontFamily: 'WantedSans',
    color: 'white',
    fontWeight: '700',
  },
});
