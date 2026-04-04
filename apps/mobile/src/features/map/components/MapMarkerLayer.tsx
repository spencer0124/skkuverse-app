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
import { Platform, StyleSheet, Text, View } from 'react-native';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import { useLayerMarkers, type MapLayerDef, useSettingsStore, SdsColors } from '@skkuverse/shared';

const MARKER_ICON = require('../../../../assets/images/transparent_1x1.png');

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

const DOT_SIZE = 16;

const NumberDotMarker = React.memo(function NumberDotMarker({
  displayNo,
}: {
  displayNo: string;
}) {
  return (
    <View collapsable={false} style={styles.dotMarker}>
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

          // Android: custom view markers are unreliable due to bitmap snapshot
          // race condition (RNCNaverMapMarker.kt #120, #143).
          // Use image-based markers with caption instead.
          if (Platform.OS === 'android') {
            return (
              <NaverMapMarkerOverlay
                key={key}
                latitude={marker.lat}
                longitude={marker.lng}
                width={DOT_SIZE}
                height={DOT_SIZE}
                anchor={{ x: 0.5, y: 0.5 }}
                image={MARKER_ICON}
                caption={{
                  text,
                  textSize: 9,
                  color: '#333333',
                  requestedWidth: 200,
                }}
                onTap={marker.skkuId != null ? () => onMarkerTap(marker.skkuId!) : undefined}
              />
            );
          }

          return (
            <NaverMapMarkerOverlay
              key={key}
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

const PIN_COLOR = SdsColors.brand;
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
    marginTop: -4,
  },
  numberText: {
    fontSize: 7,
    fontFamily: 'WantedSans',
    color: 'black',
    fontWeight: '600',
  },
});
