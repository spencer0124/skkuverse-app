/**
 * Campus segment toggle — compact 인사캠/자과캠 tabs.
 *
 * Uses RN Community native UISegmentedControl. iOS 26+ auto-applies Liquid
 * Glass at the system level (no per-component glass wrapping). iOS<26 / Android
 * render the platform-default segmented control.
 *
 * Note: native UISegmentedControl does not emit on re-tap of the active
 * segment, so the previous "tap-to-recenter map" behavior is dropped here.
 * The user can pinch/pan the map; if recenter becomes a frequent need, add
 * a separate locator button rather than overlaying hit-detection on the
 * native control (would break accessibility).
 */

import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useMapLayerStore, type CampusDef } from '@skkuverse/shared';
import { logCampusSwitch } from '@/services/analytics';

interface CampusToggleProps {
  campuses: CampusDef[];
}

export function CampusToggle({ campuses }: CampusToggleProps) {
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
  const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);

  const selectedIndex = Math.max(
    0,
    campuses.findIndex((c) => c.id === selectedCampus),
  );

  return (
    <SegmentedControl
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
      style={{ alignSelf: 'stretch' }}
    />
  );
}
