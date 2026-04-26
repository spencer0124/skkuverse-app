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
 * Visual design — Path A (Apple pattern), full-width 3-zone layout:
 *   We do NOT wrap children in our own GlassView. iOS 26's UITabAccessory
 *   automatically applies a Liquid Glass material to the entire accessory
 *   area, and that material is forced full-width regardless of contentView
 *   intrinsic size (verified empirically 2026-04-26 — UITabAccessory.h
 *   exposes only contentView/initWithContentView:; no width opt-out).
 *
 *   Layout (left-to-right):
 *     ┌──────────────────────────────────────────────────┐
 *     │  🔍 공지 검색                    │   [▽ 정렬]    │
 *     └──────────────────────────────────────────────────┘
 *     - Left zone (flex:1): search Pressable (icon + placeholder text)
 *     - Hairline divider (vertical, grey300)
 *     - Right: sort icon button (FunnelSimple — 3 lines decreasing
 *       downward, equivalent to SF Symbol `line.3.horizontal.decrease`)
 *
 * State hoisting: any user-mutable state lives in noticesUiStore. On RN >= 0.82
 * (Expo SDK 55+), rn-screens mounts BOTH 'regular' and 'inline' instances
 * simultaneously (BottomTabs.tsx:74-85); local useState would desync. Current
 * RN 0.81 path (DisplayLink, BottomTabs.tsx:86-92) mounts a single instance,
 * but external store is forward-compatible. (No accessory-owned state today
 * since all controls are stub onPress, but the store field stays for
 * Phase 2 wiring.)
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

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FunnelSimpleIcon, MagnifyingGlassIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';

const ICON_BUTTON = 36;

export function NoticesAccessoryBar() {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          // TODO Phase 2: 검색 라우트/모달 진입
        }}
        style={({ pressed }) => [
          styles.searchZone,
          pressed && styles.searchZonePressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.search')}
      >
        <MagnifyingGlassIcon size={18} color={SdsColors.grey500} />
        <Text style={styles.searchText}>
          {t('notices.accessory.searchPlaceholder')}
        </Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        onPress={() => {
          // TODO Phase 2: 정렬 옵션 시트 present
        }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.sort')}
      >
        <FunnelSimpleIcon size={22} color={SdsColors.grey900} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  // Left zone — search bar affordance. flex:1 takes remaining width;
  // icon + placeholder text inline. Glass material below provides the
  // visual container so no own background needed.
  searchZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: ICON_BUTTON,
  },
  searchText: {
    fontSize: 15,
    color: SdsColors.grey500,
  },
  searchZonePressed: {
    opacity: 0.6,
  },
  // Vertical hairline separator between search zone and action group —
  // signals "these belong to a different functional cluster" the way
  // iOS toolbars / context menus do.
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: SdsColors.grey300,
  },
  iconBtn: {
    width: ICON_BUTTON,
    height: ICON_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ICON_BUTTON / 2,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
});
