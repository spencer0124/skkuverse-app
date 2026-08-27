/**
 * Campus segment toggle — compact 인사캠/자과캠 tabs.
 *
 * Sits in the floating control row over the map, in the slot the search bar
 * used to hold (the search bar moved into the sheet). It therefore has to
 * occupy exactly that footprint: `flex: 1` for the width the row leaves after
 * the circular buttons, and `MAP_CONTROL_HEIGHT` for the height — the same
 * constant the search bar and the filter button use, so the row cannot end up
 * with three subtly different heights.
 *
 * The height is set explicitly rather than left to the control. UIKit picks its
 * own height for a UISegmentedControl and SDS's fallback derives one from its
 * padding, so without this the iOS 26 path and the fallback path would be two
 * different sizes on the same row.
 *
 * iOS 26+ (GLASS_AVAILABLE): native UISegmentedControl. System auto-applies
 * Liquid Glass material (no per-component glass wrapping).
 * iOS <26 / Android: SDS pill — unified with bus/schedule.tsx and SearchScreen.tsx.
 *
 * Note: native UISegmentedControl does not emit on re-tap of the active
 * segment, so the previous "tap-to-recenter map" behavior is dropped here.
 * The user can pinch/pan the map; if recenter becomes a frequent need, add
 * a separate locator button rather than overlaying hit-detection on the
 * native control (would break accessibility).
 */

import { Platform, StyleSheet } from 'react-native';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { SegmentedControl as SDSSegmentedControl } from '@skkuverse/sds';
import { useMapLayerStore, type CampusDef } from '@skkuverse/shared';
import { GlassSurface } from '@/components/glass';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';
import { logCampusSwitch } from '@/services/analytics';

const GLASS_AVAILABLE = isLiquidGlassAvailable();


interface CampusToggleProps {
  campuses: CampusDef[];
}

export function CampusToggle({ campuses }: CampusToggleProps) {
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
  const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);

  if (Platform.OS === 'ios' && GLASS_AVAILABLE) {
    const selectedIndex = Math.max(
      0,
      campuses.findIndex((c) => c.id === selectedCampus),
    );
    return (
      // Real glass behind the control, rather than a colour on the control.
      //
      // `backgroundColor` was the first attempt and it does show up — but it is
      // a flat fill on the host view's layer, so it tints without blurring and
      // reads as a grey plate rather than as the same material the chips and
      // the filter button beside it are made of.
      //
      // Stacking our `GlassSurface` under UIKit's is safe here specifically
      // because the unselected track contributes nothing over the map: it is
      // see-through with no blur of its own, which is the whole reason the label
      // was sitting on raw cartography. So this fills a gap instead of doubling
      // a material. The control itself now paints no background at all, and only
      // its selected pill and labels ride on top.
      <GlassSurface style={styles.trackSurface}>
        <NativeSegmentedControl
          values={campuses.map((c) => c.label)}
          selectedIndex={selectedIndex}
          onChange={(event) => {
            const idx = event.nativeEvent.selectedSegmentIndex;
            const next = campuses[idx];
            if (next && next.id !== selectedCampus) {
              setSelectedCampus(next.id);
              logCampusSwitch(next.id);
            }
          }}
          style={styles.control}
        />
      </GlassSurface>
    );
  }

  return (
    <SDSSegmentedControl
      style={styles.control}
      value={selectedCampus}
      onValueChange={(v) => {
        const next = campuses.find((c) => c.id === v);
        if (next && next.id !== selectedCampus) {
          setSelectedCampus(next.id);
          logCampusSwitch(next.id);
        }
      }}
    >
      {campuses.map((c) => (
        <SDSSegmentedControl.Item key={c.id} value={c.id} typography="t7">
          {c.label}
        </SDSSegmentedControl.Item>
      ))}
    </SDSSegmentedControl>
  );
}

const styles = StyleSheet.create({
  /**
   * Carries the row geometry now, because it is the outermost node on the iOS 26
   * path. `overflow: 'hidden'` is what actually clips the glass to the capsule —
   * `borderRadius` alone rounds a layer's own fill, not the material rendered
   * inside it.
   */
  trackSurface: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    overflow: 'hidden',
  },
  control: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    // Kept matching the surface's capsule so nothing the control paints on its
    // own layer — a future tint, a pressed state — can square off past it.
    // Half the height, not a fixed number, so it tracks `MAP_CONTROL_HEIGHT`.
    borderRadius: MAP_CONTROL_HEIGHT / 2,
  },
});
