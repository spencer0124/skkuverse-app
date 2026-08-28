/**
 * Renders one map layer's markers.
 *
 * **Layers share endpoints.** Both building layers come from
 * `/map/markers/campus`, all six event layers from `/map/markers/eskara26`, and
 * the marker cache is keyed on the endpoint string — so layers sharing a URL
 * share one fetch and one cache entry, and each renders only the subset carrying
 * its own `layerId`. Without that filter every layer draws the whole response:
 * two building layers drew all 137 buildings each, so every building appeared
 * twice with its number and its name colliding.
 *
 * Deliberately NOT filtered by the selected campus. The camera can leave the
 * selected campus without the toggle moving — the locate button is the ordinary
 * way that happens — and a campus filter meant the buildings under the camera
 * were not merely off-screen but absent from the tree entirely, so the map went
 * blank where it should have been most useful (ADR 0008 §4).
 *
 * Marker styles from MapLayerDef.markerStyle:
 * - textLabel:   localized text as a caption on a 1x1 transparent icon, with
 *                collision hiding. Building names.
 * - placeDot:    the SDK's tintable base icon in the layer's colour, captioned.
 *                Booths. No React children — see the key note below.
 * - numberCircle / numberDot / absent: filled circle with the text inside plus a
 *                caption. Building numbers. These two share one branch; the
 *                server ships numberCircle and there has never been a second
 *                rendering for it.
 *
 * Flutter source: MapLayerController._buildMarkersFromJson
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import {
  useLayerMarkers,
  useVisibleByWindow,
  type MapLayerDef,
  type MarkerTap,
  type RawMarkerData,
  useSettingsStore,
  SdsColors,
} from '@skkuverse/shared';

import { toCssColor } from '../utils/toCssColor';

const MARKER_ICON = require('../../../../assets/images/transparent_1x1.png');

const DOT_SIZE = 16;

/** The tintable base icon's natural proportions, so the tint is not distorted. */
const PIN_WIDTH = 22;
const PIN_HEIGHT = 30;

/**
 * Pick the string to draw for the current app language.
 *
 * `zh` used to fall through to Korean here, which was survivable while only
 * buildings had text — they carry `{ko, en}` and nothing else. Booth titles may
 * carry `zh`, and the server goes out of its way to preserve it, so a map whose
 * layer labels are Chinese and whose booths are Korean would be the one thing
 * worse than either.
 */
function pickText(text: RawMarkerData['text'], lang: string): string {
  if (lang === 'en') return text.en || text.ko;
  if (lang === 'zh') return text.zh || text.ko;
  return text.ko;
}

const NumberDotMarker = React.memo(function NumberDotMarker({
  label,
}: {
  label: string;
}) {
  return (
    <View
      key={label}
      collapsable={false}
      renderToHardwareTextureAndroid
      style={styles.dotMarker}
    >
      <Text style={styles.dotText}>{label}</Text>
    </View>
  );
});

interface MapMarkerLayerProps {
  layer: MapLayerDef;
  onMarkerTap: (tap: MarkerTap) => void;
}

export function MapMarkerLayer({ layer, onMarkerTap }: MapMarkerLayerProps) {
  const { data: markers } = useLayerMarkers(layer.endpoint, true);
  const lang = useSettingsStore((s) => s.appLanguage);

  // Layers share endpoints, so this is what separates one layer from another.
  const own = useMemo(
    () => (markers ?? []).filter((m) => m.layerId === layer.id),
    [markers, layer.id],
  );

  // A booth appears and disappears on the device's clock rather than on a
  // refetch: the payload is identical either side of a boundary, so this hook
  // owns the timer that makes the boundary observable at all.
  const visible = useVisibleByWindow(own);

  if (!visible.length) return null;

  return (
    <>
      {visible.map((marker) => {
        // `id` is unique within a layer but NOT across layers — one building is
        // drawn once per building layer and both markers carry the same id — so
        // the layer id is part of the key rather than decoration.
        const key = `${layer.id}-${marker.id}`;
        const label = pickText(marker.text, lang);
        const onTap = marker.tap ? () => onMarkerTap(marker.tap!) : undefined;

        if (layer.markerStyle === 'textLabel') {
          return (
            <NaverMapMarkerOverlay
              key={key}
              latitude={marker.lat}
              longitude={marker.lng}
              width={1}
              height={1}
              image={MARKER_ICON}
              caption={{
                text: label,
                textSize: layer.style?.captionTextSize ?? 7,
                color: toCssColor(layer.style?.color, 'black'),
                requestedWidth: 200,
              }}
              isHideCollidedCaptions
              globalZIndex={100000}
              onTap={onTap}
            />
          );
        }

        if (layer.markerStyle === 'placeDot') {
          return (
            <NaverMapMarkerOverlay
              // No `label` in this key, unlike the branch below, and that is not
              // an oversight: this marker has no React children, so there is no
              // custom-view bitmap to force a re-capture of. The caption is a
              // native prop the SDK re-applies on its own — it hashes the
              // caption into `caption.key` and updates when the hash changes.
              key={key}
              latitude={marker.lat}
              longitude={marker.lng}
              width={PIN_WIDTH}
              height={PIN_HEIGHT}
              // The SDK's BLACK symbol is Naver's tintable base, so the layer's
              // own colour renders exactly rather than being snapped to one of
              // the seven built-in symbol colours. Drawing this as a child View
              // instead would re-enter the Android bitmap-snapshot race for
              // ~100 markers at once, and buy nothing.
              image={{ symbol: 'black' }}
              tintColor={toCssColor(layer.style?.color, SdsColors.brand)}
              caption={{
                text: label,
                textSize: layer.style?.captionTextSize ?? 9,
                requestedWidth: 200,
              }}
              // The density lever for a layer that really does put every marker
              // on screen at once, which the building layers never do.
              isHideCollidedCaptions
              onTap={onTap}
            />
          );
        }

        // numberCircle / numberDot / absent — the building-number rendering.
        return (
          <NaverMapMarkerOverlay
            // `label` is in the key as an Android bitmap-recapture workaround,
            // NOT for uniqueness — `${layer.id}-${marker.id}` is already unique.
            // Android captures the child View with `draw(canvas)` and gets a 1x1
            // transparent bitmap if layout has not finished; putting the visible
            // content in the key remounts the View and forces a re-capture. This
            // layer subscribes to appLanguage, so dropping `label` here would
            // leave every dot blank after a language switch, on Android only.
            // See docs/explanation/android-naver-map-markers.md.
            key={`${key}-${label}`}
            latitude={marker.lat}
            longitude={marker.lng}
            width={DOT_SIZE}
            height={DOT_SIZE}
            anchor={{ x: 0.5, y: 1.0 }}
            // No caption, and that is the change the unified schema forced.
            // This used to draw the number inside the dot from `displayNo` and
            // the building NAME underneath from `text`, which worked because
            // `?overlay=number` and `?overlay=label` were separate requests
            // populating different fields — the number layer's markers had no
            // `text`, so this caption resolved to an empty string.
            //
            // One endpoint now, and one field: `text` is whatever this marker
            // displays, which on this layer is the number itself. Captioning it
            // prints the number a second time beside its own dot. The name is
            // the `building_labels` layer's job, which is the whole reason the
            // two are separate layers.
            onTap={onTap}
          >
            <NumberDotMarker label={label} />
          </NaverMapMarkerOverlay>
        );
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
