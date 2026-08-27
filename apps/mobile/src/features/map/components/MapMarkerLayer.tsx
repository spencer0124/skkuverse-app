/**
 * Renders every marker in a single map layer, across both campuses.
 *
 * Deliberately NOT filtered by the selected campus. The camera can leave the
 * selected campus without the toggle moving — the locate button is the ordinary
 * way that happens — and a campus filter meant the buildings under the camera
 * were not merely off-screen but absent from the tree entirely, so the map went
 * blank where it should have been most useful.
 *
 * Rendering both is cheap here and only here: the two campuses are ~33km apart,
 * so one is always outside the viewport and the SDK culls it natively, and the
 * endpoint already returns both sets in one response, so nothing extra is
 * fetched. Both layers, both campuses is well under 200 overlays. Revisit this
 * if a layer ever covers a single dense area, where every marker really would
 * be on screen at once.
 *
 * Four marker styles from MapLayerDef.markerStyle:
 * - numberDot: filled circle with number, building name caption (default)
 * - numberCircle: circle icon + pin point + building number caption
 * - textLabel: localized text, tiny dot, caption with collision hiding
 * - default: small dot marker, no caption
 *
 * Flutter source: MapLayerController._buildMarkersFromJson
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import { useLayerMarkers, type MapLayerDef, useSettingsStore, SdsColors } from '@skkuverse/shared';

const MARKER_ICON = require('../../../../assets/images/transparent_1x1.png');

const DOT_SIZE = 16;

/** Bare hex, no `#` — 3, 6 or 8 digits. */
const BARE_HEX_RE = /^[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?$/;

/**
 * `MapLayerStyle.color` arrives as hex *without* a leading `#` (the server's
 * commented-out bus layers read `color: "4CAF50"`, and MapPolylineLayer's
 * hexToRgba strips one defensively). React Native needs the `#`, and would
 * otherwise silently fall back to black — which is exactly the hardcoded value
 * this is meant to make configurable. Anything that is not bare hex (a named
 * colour, an already-prefixed value) passes through untouched.
 */
function toCssColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  return BARE_HEX_RE.test(raw) ? `#${raw}` : raw;
}

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
  onMarkerTap: (skkuId: number) => void;
}

export function MapMarkerLayer({ layer, onMarkerTap }: MapMarkerLayerProps) {
  const { data: markers } = useLayerMarkers(layer.endpoint, true);
  const lang = useSettingsStore((s) => s.appLanguage);

  if (!markers?.length) return null;

  return (
    <>
      {markers.map((marker, i) => {
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
                color: toCssColor(layer.style?.color, 'black'),
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
                textSize: layer.style?.captionTextSize ?? 9,
                color: toCssColor(layer.style?.color, '#333333'),
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
