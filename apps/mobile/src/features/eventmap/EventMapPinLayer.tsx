/**
 * Event map pins — one marker per deduped stack.
 *
 * Pins, not clusters, and that is a decision rather than a "not yet". The
 * library's cluster leaf accepts only identifier/lat/lng/image/width/height: no
 * caption, no per-marker onTap, no alpha. Clustering would erase booth NAMES —
 * the primary affordance on a festival map — and make dim-when-closed
 * inexpressible. Upstream has had the enabling issue open and stale-closed since
 * 2024. `render: 'pin' | 'cluster' | 'list'` stays in the wire contract, so if
 * that ever changes it is a server edit. Density is handled by
 * `isHideCollidedCaptions`, per-layer zoom bounds, and stackKey instead.
 *
 * NO React children. A custom-view marker child triggers the Android
 * bitmap-snapshot race documented in docs/explanation/android-naver-map-markers.md,
 * which MapMarkerLayer's numberDot branch has to work around with
 * `collapsable={false}` + `renderToHardwareTextureAndroid`. Symbol and httpUri
 * images go through the native path and never enter that code at all.
 */

import React from 'react';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import { SdsColors, type EventMapStack, type IconSpec } from '@skkuverse/shared';
import { resolveIcon } from './icon';

/**
 * Markers default to globalZIndex 200000 and MapMarkerLayer's textLabel branch
 * sits at 100000 (the arrow-overlay tier), so this clears both: event pins are
 * the point of the screen while an event is on.
 */
const EVENT_PIN_Z = 200001;

/** Dims icon AND caption together, which is why it complements iconIdClosed. */
const CLOSED_ALPHA = 0.45;

interface EventMapPinLayerProps {
  stacks: readonly EventMapStack[];
  icons: Record<string, IconSpec>;
  onSelectStack: (stackKey: string) => void;
}

export const EventMapPinLayer = React.memo(function EventMapPinLayer({
  stacks,
  icons,
  onSelectStack,
}: EventMapPinLayerProps) {
  if (stacks.length === 0) return null;

  return (
    <>
      {stacks.map((stack) => {
        const item = stack.lead;
        const closed = item.status === 'closed';
        // Swap art AND dim: the closed icon carries the meaning, the alpha
        // carries the emphasis. Either alone reads as a rendering glitch.
        const { image, width, height } = resolveIcon(
          icons,
          closed && item.iconIdClosed ? item.iconIdClosed : item.iconId,
        );
        const extra = stack.items.length - 1;

        return (
          <NaverMapMarkerOverlay
            key={stack.stackKey}
            latitude={item.lat}
            longitude={item.lng}
            image={image}
            {...(width != null && { width })}
            {...(height != null && { height })}
            anchor={{ x: 0.5, y: 1 }}
            alpha={closed ? CLOSED_ALPHA : 1}
            caption={{
              // "+2" rather than a cluster count: it says another occupant shares
              // this plot, which is a different fact from "N pins are nearby".
              text: extra > 0 ? `${item.title} +${extra}` : item.title,
              textSize: 11,
              color: SdsColors.grey900,
              // Event pins sit denser than the building layer and often over
              // photographic basemap detail, so the caption needs a halo to stay
              // legible rather than a darker colour.
              haloColor: '#FFFFFF',
              requestedWidth: 200,
            }}
            isHideCollidedCaptions
            globalZIndex={EVENT_PIN_Z}
            zIndex={item.pinPriority}
            {...(stack.minZoom != null && { minZoom: stack.minZoom })}
            {...(stack.maxZoom != null && { maxZoom: stack.maxZoom })}
            onTap={() => onSelectStack(stack.stackKey)}
          />
        );
      })}
    </>
  );
});
