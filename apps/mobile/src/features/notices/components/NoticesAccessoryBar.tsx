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
 * Visual design — 4-icon toolbar (peer actions, evenly distributed):
 *   We do NOT wrap children in our own GlassView. iOS 26's UITabAccessory
 *   automatically applies a Liquid Glass material to the entire accessory
 *   area, and that material is forced full-width regardless of contentView
 *   intrinsic size (verified empirically 2026-04-26 — UITabAccessory.h
 *   exposes only contentView/initWithContentView:; no width opt-out).
 *
 *   Layout (space-around, no dividers — all icons are peer actions):
 *     ┌──────────────────────────────────────────────────┐
 *     │   🔍       🔖        ▽         🔔                │
 *     │ search   bookmark  filter   notifications        │
 *     └──────────────────────────────────────────────────┘
 *
 *   Each icon pushes to its dedicated route (search results / bookmarks /
 *   filter sheet / notifications). Inline TextInput inside the accessory
 *   was prototyped on feat/notices-search-prototype and abandoned —
 *   rn-screens 4.19 doesn't wire keyboard avoidance for UITabAccessory,
 *   and reanimated useAnimatedKeyboard translateY had no visible effect
 *   (likely contentView clip + worklet tree isolation). Push-to-route
 *   from icon tap sidesteps both issues.
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

import { Pressable, StyleSheet, View } from 'react-native';
import {
  BellIcon,
  BookmarkSimpleIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
} from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';

const ICON_BUTTON = 36;
const ICON_SIZE = 22;

export function NoticesAccessoryBar() {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          // TODO: push to /notices/search
        }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.search')}
      >
        <MagnifyingGlassIcon size={ICON_SIZE} color={SdsColors.grey700} />
      </Pressable>

      <Pressable
        onPress={() => {
          // TODO: push to /notices/bookmarks
        }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.bookmark')}
      >
        <BookmarkSimpleIcon size={ICON_SIZE} color={SdsColors.grey700} />
      </Pressable>

      <Pressable
        onPress={() => {
          // TODO: push to /notices/filter (or present sheet)
        }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.filter')}
      >
        <FunnelSimpleIcon size={ICON_SIZE} color={SdsColors.grey700} />
      </Pressable>

      <Pressable
        onPress={() => {
          // TODO: push to /notices/notifications
        }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.notifications')}
      >
        <BellIcon size={ICON_SIZE} color={SdsColors.grey700} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
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
