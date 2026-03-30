/**
 * Renders a polyline overlay for a single map layer.
 *
 * Flutter source: MapLayerController._buildPolylineFromJson
 */

import { useMemo } from 'react';
import { NaverMapPathOverlay } from '@mj-studio/react-native-naver-map';
import { useLayerPolyline, type MapLayerDef } from '@skkuverse/shared';

interface MapPolylineLayerProps {
  layer: MapLayerDef;
}

function hexToRgba(hex: string, alpha = 1): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function MapPolylineLayer({ layer }: MapPolylineLayerProps) {
  const { data: coords } = useLayerPolyline(layer.endpoint, true);

  const pathCoords = useMemo(() => {
    if (!coords || coords.length < 2) return null;
    return coords.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  }, [coords]);

  if (!pathCoords) return null;

  return (
    <NaverMapPathOverlay
      coords={pathCoords}
      width={layer.style?.width ?? 4}
      color={layer.style?.color ? hexToRgba(layer.style.color) : '#4CAF50'}
      outlineWidth={layer.style?.outlineColor ? 1 : 0}
      outlineColor={
        layer.style?.outlineColor
          ? hexToRgba(layer.style.outlineColor)
          : 'transparent'
      }
    />
  );
}
