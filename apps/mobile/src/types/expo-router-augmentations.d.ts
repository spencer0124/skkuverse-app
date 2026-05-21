declare module 'expo-router/unstable-native-tabs' {
  import type { ReactNode } from 'react';
  interface NativeTabsProps {
    /**
     * iOS 26+ tab bar accessory. Patched-through to react-native-screens
     * BottomTabs via patches/expo-router+6.0.23.patch.
     *
     * Callback receives 'regular' | 'inline' as a string per rn-screens 4.19
     * BottomTabs.tsx:80,83 — NOT the SDK 55 `{placement}` object form.
     *
     * REMOVE WHEN: Upgrading to Expo SDK 55+. Switch (tabs)/_layout.tsx to
     * <NativeTabs.BottomAccessory> wrapper, then delete this file and the
     * patch.
     */
    bottomAccessory?: (environment: 'regular' | 'inline') => ReactNode;
  }
}
export {};
