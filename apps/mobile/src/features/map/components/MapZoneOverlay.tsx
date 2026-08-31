/**
 * One polygon overlay — a 취식존, a stage area, a 통제 구간 outline.
 * <!-- conventions:allow-korean: the zone names the app draws -->
 *
 * A zone is an ordinary overlay on an ordinary layer: it arrives in the same
 * collection as the booths, carries the same `tap`, and opens the same sheet.
 * That is the whole reason zones ride the marker query's endpoint rather than
 * one of their own — a tappable zone outside the query that backs the detail
 * sheet would be a place the sheet could not describe.
 *
 * ## Two style fields that are not optional in practice
 *
 * `NaverMapPolygonOverlay` defaults `color` to OPAQUE BLACK and `outlineWidth`
 * to 0. A zone drawn from an unstyled layer is therefore a borderless black
 * rectangle over the booths it exists to group — not a subtle regression. The
 * server sends `fillOpacity` and `outlineWidth` for exactly this reason, and
 * the fallbacks below assume nothing about them arriving.
 */

import { useCallback, useMemo } from 'react';
import { NaverMapPolygonOverlay } from '@mj-studio/react-native-naver-map';
import { SdsColors, type MapLayerDef, type MapOverlay, type MarkerTap } from '@skkuverse/shared';

import { toCssColor } from '../utils/toCssColor';
import { toPolygonGeometry, withAlpha } from '../utils/overlayGeometry';

interface MapZoneOverlayProps {
  overlay: Extract<MapOverlay, { kind: 'polygon' }>;
  layerStyle: MapLayerDef['style'];
  onOverlayTap: (tap: MarkerTap) => void;
}

export function MapZoneOverlay({ overlay, layerStyle, onOverlayTap }: MapZoneOverlayProps) {
  // The ring reversal is the expensive part and the rings never change identity
  // between refetches of an unchanged response, so this runs once per zone.
  const geometry = useMemo(() => toPolygonGeometry(overlay.rings), [overlay.rings]);

  const tap = overlay.tap;
  const onTap = useCallback(() => {
    if (tap) onOverlayTap(tap);
  }, [tap, onOverlayTap]);

  if (!geometry) return null;

  // The layer's primary paint, at the alpha the layer asked for. `color` means
  // the fill here and the tint on a marker layer — one field, three meanings,
  // resolved by what is being drawn.
  const fill = withAlpha(toCssColor(layerStyle?.color, SdsColors.brand), layerStyle?.fillOpacity);

  return (
    <NaverMapPolygonOverlay
      coords={geometry.coords}
      holes={geometry.holes}
      color={fill}
      // The outline falls back to the fill's own colour at FULL strength, which
      // is what the festival layers ask for explicitly (they send `outlineColor`
      // equal to `color`) and what campus geometry wants implicitly — it sends
      // neither, because an outline on the base map belongs to a design token
      // that resolves per theme rather than to a hex on the wire.
      outlineColor={toCssColor(layerStyle?.outlineColor, toCssColor(layerStyle?.color, SdsColors.brand))}
      outlineWidth={layerStyle?.outlineWidth}
      // Undefined is the SDK's own "no bound", so an unstyled layer draws at
      // every zoom rather than at none.
      minZoom={layerStyle?.minZoom}
      maxZoom={layerStyle?.maxZoom}
      // `tap: null` is a BACKDROP — drawn, deliberately not pressable. Wiring a
      // handler anyway would make a boundary outline swallow taps meant for the
      // markers inside it.
      onTap={tap ? onTap : undefined}
    />
  );
}
