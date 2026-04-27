import { useCallback } from 'react';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useFocusEffect } from '@react-navigation/native';
import { useSettingsStore, type TabRoute } from '@skkuverse/shared';
import { logTabSwitch } from '@/services/analytics';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

// iOS 26+ uses NativeTabs which doesn't expose React Navigation's
// screenListeners — log via useFocusEffect here. iOS < 26 and Android go
// through the JSX <Tabs screenListeners> path in (tabs)/_layout.tsx, so
// skip here to avoid double tracking. Predicate mirrors the fork in
// (tabs)/_layout.tsx (Platform.OS === 'ios' && GLASS_AVAILABLE) — keep
// them in sync. Timing differs vs. screenListeners: this fires after the
// focused screen mounts and settles, not at navigation-state commit.
// Verified scenarios: deep link cold mount, bg→fg + tab switch, rapid tab
// toggling.
export function useTabFocusTracking(tab: TabRoute) {
  const setLastTab = useSettingsStore((s) => s.setLastTab);

  useFocusEffect(
    useCallback(() => {
      if (!GLASS_AVAILABLE) return;
      logTabSwitch(tab);
      setLastTab(tab);
    }, [tab, setLastTab]),
  );
}
