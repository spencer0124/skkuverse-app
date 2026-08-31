/**
 * One path overlay — a walking route, a shuttle line, a parade course.
 *
 * Replaces `MapPolylineLayer`, which fetched `/map/overlays/:overlayId` (a
 * route that no longer exists) through a second parser that read `data.coords`
 * as `[lat, lng]` — the reverse of GeoJSON, with no validation and no range
 * guard. Line geometry now arrives as `kind: "path"` in the ordinary
 * collection, so a route line costs no extra request and goes through the same
 * checked conversion every other overlay does.
 *
 * `NaverMapPathOverlay` rather than `NaverMapPolylineOverlay`: the path overlay
 * carries an outline, which is what keeps a coloured line legible over a
 * satellite basemap. The polyline overlay is the lighter one with dash patterns
 * and cap/join control, and the server reserves a separate `kind` for it — so
 * when a layer wants dashes it arrives as `polyline` and gets its own component
 * rather than a flag on this one.
 */

import { useCallback, useMemo } from 'react';
import { NaverMapPathOverlay } from '@mj-studio/react-native-naver-map';
import { SdsColors, type MapLayerDef, type MapOverlay, type MarkerTap } from '@skkuverse/shared';

import { toCssColor } from '../utils/toCssColor';
import { toNaverCoords } from '../utils/overlayGeometry';

/**
 * Stroke thickness when the layer does not say.
 *
 * Read off `style.width`, which the wire documents as the PIN width. That is
 * double duty rather than a clean fit, and it is deliberate for now: no layer
 * draws both a pin and a path today, so a second field would be dead on every
 * layer that exists. A layer that ever needs both needs a `strokeWidth` on the
 * wire — and this comment is where that will be noticed.
 */
const DEFAULT_STROKE = 4;

interface MapRouteOverlayProps {
  overlay: Extract<MapOverlay, { kind: 'path' }>;
  layerStyle: MapLayerDef['style'];
  onOverlayTap: (tap: MarkerTap) => void;
}

export function MapRouteOverlay({ overlay, layerStyle, onOverlayTap }: MapRouteOverlayProps) {
  const coords = useMemo(() => toNaverCoords(overlay.line), [overlay.line]);

  const tap = overlay.tap;
  const onTap = useCallback(() => {
    if (tap) onOverlayTap(tap);
  }, [tap, onOverlayTap]);

  return (
    <NaverMapPathOverlay
      coords={coords}
      width={layerStyle?.width ?? DEFAULT_STROKE}
      color={toCssColor(layerStyle?.color, SdsColors.brand)}
      // Absent means no outline. The helper this replaced derived
      // `outlineColor ? 1 : 0`, a workaround for a wire that had no width field;
      // it does now, so the layer says what it wants.
      outlineWidth={layerStyle?.outlineWidth}
      outlineColor={toCssColor(layerStyle?.outlineColor, 'transparent')}
      minZoom={layerStyle?.minZoom}
      maxZoom={layerStyle?.maxZoom}
      onTap={tap ? onTap : undefined}
    />
  );
}
