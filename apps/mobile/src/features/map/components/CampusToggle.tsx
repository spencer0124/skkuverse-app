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
 * ## Why the SDS control on iOS 26 too, rather than UIKit's
 *
 * This used to render a native `UISegmentedControl` on iOS 26 for the system's
 * Liquid Glass material. It no longer does, because UIKit cannot report the one
 * interaction this control needs. `RNCSegmentedControl` binds
 * `UIControlEventValueChanged`, and UIKit does not fire that when you tap the
 * segment that is already selected — the value did not change. So a re-tap was
 * invisible, and re-tapping the active campus is exactly how a user asks to be
 * taken back to it after the locate button moved the camera away.
 *
 * `momentary` is not a way out: it makes the control forget its selection, and
 * this one has to keep showing which campus is chosen.
 *
 * SDS's `SegmentedControl.Item` calls `onValueChange` unconditionally, so the
 * re-tap arrives. The glass is not lost with it — the control renders inside
 * our own `GlassSurface` on iOS 26 and its track is made transparent so the
 * material shows through, leaving only the selected pill and the labels on top.
 * `style` is passed last, which is what lets it beat the `grey100` the control
 * paints by default.
 */

import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { GlassSurface, SegmentedControl as SDSSegmentedControl } from '@skkuverse/sds';
import { useMapLayerStore, type Campus, type CampusDef } from '@skkuverse/shared';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

interface CampusToggleProps {
  campuses: CampusDef[];
  /**
   * Fires on EVERY pick, including a re-tap of the campus already selected —
   * that case carries no state change, so it is the only signal the screen gets
   * that the user wants the camera brought back. The screen decides what a pick
   * means; this component only reports one.
   */
  onPick: (campusId: Campus) => void;
}

export function CampusToggle({ campuses, onPick }: CampusToggleProps) {
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);

  // SDS hands back the raw item value as a `string`. Recovering the union by
  // looking the id up in `campuses` keeps the closed set closed without a cast:
  // an id the config does not contain is dropped rather than forced through.
  const handleValueChange = useCallback(
    (value: string) => {
      const picked = campuses.find((c) => c.id === value);
      if (picked) onPick(picked.id);
    },
    [campuses, onPick],
  );

  const control = (
    <SDSSegmentedControl
      style={GLASS_AVAILABLE ? styles.controlOnGlass : styles.control}
      value={selectedCampus}
      onValueChange={handleValueChange}
    >
      {campuses.map((c) => (
        <SDSSegmentedControl.Item key={c.id} value={c.id} typography="t7">
          {c.label}
        </SDSSegmentedControl.Item>
      ))}
    </SDSSegmentedControl>
  );

  if (!GLASS_AVAILABLE) return control;

  // Real glass behind the control, rather than a colour on the control.
  // `overflow: 'hidden'` is what actually clips the material to the capsule —
  // `borderRadius` alone rounds a layer's own fill, not what is rendered inside.
  return <GlassSurface style={styles.trackSurface}>{control}</GlassSurface>;
}

const styles = StyleSheet.create({
  trackSurface: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    overflow: 'hidden',
  },
  control: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    // Half the height, not a fixed number, so it tracks `MAP_CONTROL_HEIGHT`.
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    justifyContent: 'center',
  },
  controlOnGlass: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    justifyContent: 'center',
    // Beats the control's own `grey100` track, which would otherwise sit as an
    // opaque plate over the glass and defeat the surface behind it.
    backgroundColor: 'transparent',
  },
});
