/**
 * Campus segment toggle — compact 인사캠/자과캠 tabs.
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

import { Platform } from 'react-native';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { SegmentedControl as SDSSegmentedControl } from '@skkuverse/sds';
import { useMapLayerStore, type CampusDef } from '@skkuverse/shared';
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
        style={{ alignSelf: 'stretch' }}
      />
    );
  }

  return (
    <SDSSegmentedControl
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
