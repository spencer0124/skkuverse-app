/**
 * iOS 26 NativeTabs bottom accessory for the Notices tab.
 *
 * Activation chain:
 *   1. iOS 26+ runtime
 *   2. patches/expo-router+6.0.23.patch forwards `bottomAccessory` prop from
 *      <NativeTabs> to react-native-screens <BottomTabs>
 *      (verified against rn-screens 4.19 BottomTabs.tsx:80,83)
 *   3. patches/react-native-screens+4.19.0.patch swallows
 *      RNSBottomAccessoryHelper KVO removeObserver NSException at invalidate
 *      (line 197 vs 115 target mismatch)
 *   4. NoticesBottomAccessoryGate in (tabs)/_layout.tsx returns this
 *      component for both 'regular' and 'inline' placements when the
 *      notices tab is focused at root (not pushed detail). Same UI shows
 *      whether the tab bar is expanded or scroll-minimized.
 *
 * Visual design — Path A (Apple pattern):
 *   We do NOT wrap children in our own GlassView. iOS 26's UITabAccessory
 *   automatically applies a Liquid Glass material to the entire accessory
 *   area, and that material is NOT opt-out-able via public APIs (verified
 *   against UIKit's UITabAccessory.h: only contentView + initWithContentView:
 *   are exposed; UITabBarController.bottomAccessory has no appearance hook;
 *   SwiftUI's tabViewBottomAccessory takes only `content:` and `isEnabled:`).
 *   Adding inner GlassViews would create a glass-on-glass nesting. Instead
 *   we render the search input and filter button as transparent controls
 *   inset within the OS-supplied glass capsule — the iOS Mail pattern.
 *
 * State hoisting: any user-mutable state lives in noticesUiStore. On RN >= 0.82
 * (Expo SDK 55+), rn-screens mounts BOTH 'regular' and 'inline' instances
 * simultaneously (BottomTabs.tsx:74-85); local useState would desync. Current
 * RN 0.81 path (DisplayLink, BottomTabs.tsx:86-92) mounts a single instance,
 * but external store is forward-compatible.
 *
 * Migration to Expo SDK 55+:
 *   1. Delete patches/expo-router+6.0.23.patch
 *   2. Delete patches/react-native-screens+4.19.0.patch (verify upstream
 *      RNSBottomAccessoryHelper KVO bug fixed first — was still present in
 *      4.25-nightly)
 *   3. In (tabs)/_layout.tsx, replace the `bottomAccessory={(env) => ...}`
 *      callback prop with the <NativeTabs.BottomAccessory> wrapper component
 *   4. State already external (useNoticesUiStore) — no change needed
 *   5. Delete src/types/expo-router-augmentations.d.ts
 */

import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FunnelSimpleIcon, MagnifyingGlassIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { useNoticesUiStore } from '../store/noticesUiStore';

const PILL_HEIGHT = 36;

export function NoticesAccessoryBar() {
  const { t } = useT();
  const searchQuery = useNoticesUiStore((s) => s.accessorySearchQuery);
  const setSearchQuery = useNoticesUiStore((s) => s.setAccessorySearchQuery);

  return (
    <View style={styles.row}>
      <View style={styles.searchInner}>
        <MagnifyingGlassIcon size={18} color={SdsColors.grey500} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('notices.accessory.searchPlaceholder')}
          placeholderTextColor={SdsColors.grey500}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel={t('notices.accessory.search')}
        />
      </View>

      <Pressable
        onPress={() => {
          // TODO Phase 2: 필터 시트/드롭다운 present
        }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.filterPressable,
          pressed && styles.filterPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.filter')}
      >
        <FunnelSimpleIcon size={20} color={SdsColors.grey700} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    minHeight: PILL_HEIGHT + 12,
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: PILL_HEIGHT,
    paddingHorizontal: 4,
  },
  searchInput: {
    flex: 1,
    height: PILL_HEIGHT,
    fontSize: 15,
    color: SdsColors.grey900,
    padding: 0,
  },
  filterPressable: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPressed: {
    opacity: 0.6,
  },
});
