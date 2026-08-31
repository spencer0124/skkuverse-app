/**
 * A thumbnail + label tile, selected by a ring.
 *
 * The ring is drawn on a wrapper that is always present and only changes
 * colour, never width. Toggling `borderWidth` instead would reflow the tile by
 * a few points on every tap, which at four-per-row is a visible twitch across
 * the whole grid.
 *
 * The ring is brand green rather than the reference's blue: the layout is what
 * is being copied, not another product's accent.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SdsColors, SdsTypo } from '@skkuverse/shared';
import { MapThumb, type MapThumbPalette } from './MapThumb';

interface MapTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  palette: MapThumbPalette;
  /** Centre overlay marking what the tile adds to the map (an emoji glyph). */
  badge?: ReactNode;
}

export function MapTile({ label, selected, onPress, palette, badge }: MapTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.tile}
    >
      <View style={[styles.ring, selected && styles.ringSelected]}>
        <View style={styles.thumb}>
          <MapThumb palette={palette} />
          {badge ? (
            // An absolute overlay, not a flow sibling. The SVG above is
            // `height: 100%`, so a sibling in flow starts below it and gets
            // clipped away by the thumbnail's `overflow: hidden`.
            <View style={styles.badgeLayer} pointerEvents="none">
              <View style={styles.badge}>{badge}</View>
            </View>
          ) : null}
        </View>
      </View>
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
  },
  ring: {
    width: '100%',
    borderWidth: 2.5,
    // Transparent rather than absent, so selecting cannot change the layout.
    borderColor: 'transparent',
    borderRadius: 18,
    padding: 2.5,
  },
  ringSelected: {
    borderColor: SdsColors.brand,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 13,
    // Clips the SVG's deliberately over-scanned shapes to the rounded square.
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.grey100,
  },
  badgeLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts the badge off a busy thumbnail without a border, which at this size
    // would read as a second ring competing with the selection ring.
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: {
    ...SdsTypo.t7,
    fontWeight: '600',
    color: SdsColors.grey700,
    marginTop: 8,
    textAlign: 'center',
  },
  labelSelected: {
    color: SdsColors.brand,
    fontWeight: '700',
  },
});
