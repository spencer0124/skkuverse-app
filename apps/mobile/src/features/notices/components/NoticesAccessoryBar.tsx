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
 * Visual design — search pill + 2 secondary icons (Toss-style hierarchy):
 *   We do NOT wrap children in our own GlassView. iOS 26's UITabAccessory
 *   automatically applies a Liquid Glass material to the entire accessory
 *   area, and that material is forced full-width regardless of contentView
 *   intrinsic size (verified empirically 2026-04-26 — UITabAccessory.h
 *   exposes only contentView/initWithContentView:; no width opt-out).
 *
 *   Layout (left-to-right, 2 vertical dividers between peers):
 *     ┌──────────────────────────────────────────────────┐
 *     │  🔍 공지 검색          │  🔖  │  ≡             │
 *     └──────────────────────────────────────────────────┘
 *     - Left (flex:1): search pill — magnifier + placeholder text
 *       (Pressable, NOT TextInput — pushes to dedicated /notices/search
 *        route since rn-screens 4.19 doesn't wire keyboard avoidance for
 *        UITabAccessory; verified on feat/notices-search-prototype 2026-04-26)
 *     - Hairline divider (vertical, grey300, height 20)
 *     - Bookmark icon (push to /notices/bookmarks)
 *     - Hairline divider
 *     - Filter icon (present sheet — sort/filter combined per Toss
 *       "filter as sheet" rule: sheet allows immediate list reflection
 *       without page navigation)
 *
 *   Hierarchy comes from search's flex:1 + placeholder text creating
 *   visual mass asymmetry vs the two right-side icon-only buttons.
 *   Dividers between all peers reinforce "main + supporting actions"
 *   reading rather than "4 equal icons". Filter uses `FunnelSimpleIcon`
 *   (3 horizontal lines decreasing — also SF Symbol
 *   `line.3.horizontal.decrease.circle` shape) instead of cone-shaped
 *   `FunnelIcon` because the visual weight better balances the row's
 *   right edge against the placeholder text on the left.
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

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BookmarkSimpleIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
} from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';

const ICON_BUTTON = 36;
const ICON_SIZE = 22;

export function NoticesAccessoryBar() {
  const { t } = useT();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push('/notices/search')}
        style={({ pressed }) => [
          styles.searchPill,
          pressed && styles.searchPillPressed,
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

      <View style={styles.divider} />

      <Pressable
        onPress={() => {
          // TODO: present filter sheet (sort + filter combined)
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  // Left zone — search pill affordance. flex:1 reserves ~70%+ of the bar
  // width regardless of right-cluster icon count, establishing search as
  // the primary action. Glass material below provides the visual container
  // so no own background needed.
  searchPill: {
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
  searchPillPressed: {
    opacity: 0.6,
  },
  // Vertical hairline separator between primary search action and the
  // secondary action cluster — signals weight asymmetry the way iOS
  // toolbars / context menus do.
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
