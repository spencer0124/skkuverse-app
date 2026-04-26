/**
 * Campus tab — Naver Map + snapping bottom sheet with SDUI content.
 *
 * Header is statically hidden by this tab's nested Stack layout. The
 * CampusScreen handles all top-area UI (search bar, HSSC/NSC toggle,
 * filter button) as floating overlays positioned via useSafeAreaInsets.
 *
 * Flutter source: lib/features/campus_map/ui/campus_map_tab.dart
 */

import { CampusScreen } from '@/features/map/CampusScreen';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

export default function CampusTab() {
  useTabFocusTracking('campus');

  return <CampusScreen />;
}
