/**
 * Renders one map layer's markers.
 *
 * **Layers share endpoints.** Both building layers come from
 * `/map/markers/campus`, every event layer from `/map/markers/event`, and
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
 * Geometry — the circle's diameter, the pin's width and height, and the label
 * layer's draw order — comes from the layer's `style`, with this file's former
 * constants as fallbacks. Only the colour stays local, because it resolves from
 * a design token per theme.
 *
 * Flutter source: MapLayerController._buildMarkersFromJson
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import {
  useLayerMarkers,
  useWindowClock,
  resolvePinCollisions,
  type MapLayerDef,
  type MarkerTap,
  type RawMarkerData,
  useSettingsStore,
  wrapMarkerLabel,
  SdsColors,
} from '@skkuverse/shared';

import { toCssColor } from '../utils/toCssColor';

const MARKER_ICON = require('../../../../assets/images/transparent_1x1.png');

/**
 * Geometry fallbacks, for a server that does not send `style` geometry.
 *
 * Every one is the constant this file hardcoded before the wire carried it, so
 * an older server renders byte-identically. The colour is deliberately NOT here
 * and deliberately NOT on the wire for the building layers: the number circle
 * and the placeDot tint fall back to `SdsColors.brand`, a design token that
 * resolves per theme, and a hex from the server cannot. Geometry is
 * theme-independent and belongs on the wire; a colour that comes from a token
 * does not.
 */
const DOT_SIZE = 16;

/** The tintable base icon's natural proportions, so the tint is not distorted. */
const PIN_WIDTH = 22;
const PIN_HEIGHT = 30;

/**
 * The number's glyph size as a fraction of the circle it sits in.
 *
 * A ratio rather than a second constant, because `size` is now the server's to
 * set: a hardcoded 7pt inside a circle the server grew to 24pt is exactly the
 * half-honouring that made the geometry decorative in the first place. 7/16
 * reproduces today's 7pt at today's 16pt circle exactly.
 */
const DOT_TEXT_RATIO = 7 / 16;

/** The label layer draws above every other overlay. Was `globalZIndex={100000}`. */
const LABEL_Z_INDEX = 100000;

/**
 * The caption's line budget, in display columns — a Hangul syllable is 2.
 *
 * NOT arbitrary: both numbers were swept against the 61 real booth titles and
 * the real building names. At these two values no wrap leaves a one-syllable
 * widow on the second line (the `600주년기념` / `관` split that reads as a
 * rendering bug), so no line-balancing code has to exist — the constant does
 * that work. Only 3 of the 61 booth titles need clamping at all.
 *
 * It is a density lever as well as a legibility one. A narrower caption collides
 * with fewer neighbours, and a collision under `isHideCollidedCaptions` hides the
 * whole label rather than shortening it, so wrapping puts MORE names on screen.
 */
const CAPTION_COLS = { textLabel: 14, placeDot: 16 } as const;
const CAPTION_MAX_LINES = 2;

/**
 * `0` is the SDK's "do not auto-wrap". It used to be 200, which sat above every
 * label it governed — the longest booth title renders at ~157dp — so it never
 * fired once. Lowering it would not have been enough either: the native wrapper
 * breaks at whitespace, and the Korean names that need breaking have none.
 * Line breaking is `wrapMarkerLabel`'s job now, and leaving a second wrapper
 * live behind it would only make the breaks non-deterministic.
 */
const NO_NATIVE_WRAP = 0;

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
  size,
}: {
  label: string;
  size: number;
}) {
  return (
    <View
      key={label}
      collapsable={false}
      renderToHardwareTextureAndroid
      style={[
        styles.dotMarker,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.dotText, { fontSize: Math.round(size * DOT_TEXT_RATIO) }]}>
        {label}
      </Text>
    </View>
  );
});

interface MapMarkerLayerProps {
  layer: MapLayerDef;
  /**
   * The layer ids whose markers compete with this one for a coordinate — the
   * FESTIVAL layers currently drawn, and nothing else.
   *
   * Two things are load-bearing about the membership. The building layers are
   * absent because they draw one building twice on purpose, a number and a name
   * at one point, from records that share an `id` — the ladder would read that
   * as a total tie and suppress one of them at random. And it is the layers
   * currently DRAWN rather than every festival layer, because a hidden 주점
   * must not suppress a visible 부스: the bar is not on the map to be seen
   * behind, so hiding it would leave a hole where the booth should be.
   */
  collisionPeers: ReadonlySet<string>;
  onMarkerTap: (tap: MarkerTap) => void;
}

export function MapMarkerLayer({
  layer,
  collisionPeers,
  onMarkerTap,
}: MapMarkerLayerProps) {
  const { data: markers } = useLayerMarkers(layer.endpoint, true);
  const lang = useSettingsStore((s) => s.appLanguage);

  const all = useMemo(() => markers ?? [], [markers]);

  // A booth changes state on the device's clock rather than on a refetch: the
  // payload is identical either side of a boundary, so this hook owns the timer
  // that makes the boundary observable at all. It no longer decides what is
  // drawn — hours are filtered on and displayed, never hidden on
  // (map-markers-api §3.3) — it decides who WINS a shared coordinate, which
  // moves with the clock for exactly the same reason.
  const now = useWindowClock(all);

  const visible = useMemo(() => {
    // Layers share endpoints, so this is what separates one layer from another.
    const own = all.filter((m) => m.layerId === layer.id);
    if (!collisionPeers.has(layer.id)) return own;
    // Resolve across every drawn peer FIRST, then take this layer's share. The
    // other order would let each layer keep its own winner and put two pins back
    // on the one coordinate the ladder exists to clear.
    const peers = all.filter((m) => collisionPeers.has(m.layerId));
    const drawn = new Set(resolvePinCollisions(peers, now));
    return own.filter((m) => drawn.has(m));
  }, [all, layer.id, collisionPeers, now]);

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
                text: wrapMarkerLabel(
                  label,
                  CAPTION_COLS.textLabel,
                  CAPTION_MAX_LINES,
                ),
                textSize: layer.style?.captionTextSize ?? 7,
                color: toCssColor(layer.style?.color, 'black'),
                requestedWidth: NO_NATIVE_WRAP,
              }}
              isHideCollidedCaptions
              globalZIndex={layer.style?.zIndex ?? LABEL_Z_INDEX}
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
              width={layer.style?.width ?? PIN_WIDTH}
              height={layer.style?.height ?? PIN_HEIGHT}
              // The SDK's BLACK symbol is Naver's tintable base, so the layer's
              // own colour renders exactly rather than being snapped to one of
              // the seven built-in symbol colours. Drawing this as a child View
              // instead would re-enter the Android bitmap-snapshot race for
              // ~100 markers at once, and buy nothing.
              image={{ symbol: 'black' }}
              tintColor={toCssColor(layer.style?.color, SdsColors.brand)}
              caption={{
                text: wrapMarkerLabel(
                  label,
                  CAPTION_COLS.placeDot,
                  CAPTION_MAX_LINES,
                ),
                textSize: layer.style?.captionTextSize ?? 9,
                requestedWidth: NO_NATIVE_WRAP,
              }}
              // The density lever for a layer that really does put every marker
              // on screen at once, which the building layers never do.
              isHideCollidedCaptions
              onTap={onTap}
            />
          );
        }

        // numberCircle / numberDot / absent — the building-number rendering.
        const dotSize = layer.style?.size ?? DOT_SIZE;
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
            // `dotSize` is in the key for the same reason `label` is: it is
            // visible content, so a server changing it has to force the same
            // re-capture a language switch does.
            key={`${key}-${label}-${dotSize}`}
            latitude={marker.lat}
            longitude={marker.lng}
            width={dotSize}
            height={dotSize}
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
            <NumberDotMarker label={label} size={dotSize} />
          </NaverMapMarkerOverlay>
        );
      })}
    </>
  );
}

const DOT_COLOR = SdsColors.brand;

const styles = StyleSheet.create({
  dotMarker: {
    // Width, height and radius are set inline from the layer's `style.size`.
    backgroundColor: DOT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    // fontSize is set inline, derived from the circle's size.
    fontFamily: 'WantedSans',
    color: 'white',
    fontWeight: '700',
  },
});
