/**
 * Campus segment toggle — compact 인사캠/자과캠 tabs.
 *
 * Uses SDS SegmentedControl for visual consistency.
 */

import { SegmentedControl } from '@skkuverse/sds';
import { useMapLayerStore, type CampusDef, SdsShadows } from '@skkuverse/shared';
import { logCampusSwitch } from '@/services/analytics';

interface CampusToggleProps {
  campuses: CampusDef[];
  onReselect?: (campus: CampusDef) => void;
}

export function CampusToggle({ campuses, onReselect }: CampusToggleProps) {
  const selectedCampus = useMapLayerStore((s) => s.selectedCampus);
  const setSelectedCampus = useMapLayerStore((s) => s.setSelectedCampus);

  const handleValueChange = (value: string) => {
    if (value === selectedCampus) {
      const campus = campuses.find((c) => c.id === value);
      if (campus) onReselect?.(campus);
    } else {
      setSelectedCampus(value);
      logCampusSwitch(value);
    }
  };

  return (
    <SegmentedControl
      value={selectedCampus}
      onValueChange={handleValueChange}
      style={{ width: 140, flexShrink: 0, ...SdsShadows.elevated.legacy }}
    >
      {campuses.map((campus) => (
        <SegmentedControl.Item key={campus.id} value={campus.id} typography="t7">
          {campus.label}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl>
  );
}
