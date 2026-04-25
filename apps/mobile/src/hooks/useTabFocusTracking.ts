import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSettingsStore, type TabRoute } from '@skkuverse/shared';
import { logTabSwitch } from '@/services/analytics';

// iOS uses NativeTabs which doesn't expose React Navigation's screenListeners.
// On Android, the existing <Tabs screenListeners> path still fires — skip
// here to avoid double tracking. Timing differs vs. screenListeners: this
// fires after the focused screen mounts and settles, not at navigation-state
// commit. Verified scenarios: deep link cold mount, bg→fg + tab switch,
// rapid tab toggling.
export function useTabFocusTracking(tab: TabRoute) {
  const setLastTab = useSettingsStore((s) => s.setLastTab);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'ios') return;
      logTabSwitch(tab);
      setLastTab(tab);
    }, [tab, setLastTab]),
  );
}
