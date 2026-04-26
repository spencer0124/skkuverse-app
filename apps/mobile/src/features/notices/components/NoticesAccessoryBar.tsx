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
 * Visual design — 3 equal peers (icon + label), dividers between:
 *   We do NOT wrap children in our own GlassView. iOS 26's UITabAccessory
 *   automatically applies a Liquid Glass material to the entire accessory
 *   area, and that material is forced full-width regardless of contentView
 *   intrinsic size (verified empirically 2026-04-26 — UITabAccessory.h
 *   exposes only contentView/initWithContentView:; no width opt-out).
 *
 *   Layout (left-to-right, 2 vertical dividers between peers):
 *     ┌──────────────────────────────────────────────────┐
 *     │   🔍 검색      │   🔖 보관함      │   ≡ 필터    │
 *     └──────────────────────────────────────────────────┘
 *     - All 5 children (3 actions + 2 dividers) sit in `space-evenly`, so
 *       the 6 boundary gaps (edge↔A1↔D1↔A2↔D2↔A3↔edge) are exactly equal.
 *       Each action sizes to its natural [icon + label] width; this keeps
 *       divider-to-content distance uniform even when label widths differ
 *       ("검색" 2ch vs "보관함" 3ch).
 *     - Hairline dividers (vertical, grey300, height 20) separate peers,
 *       reinforcing "3 toolbar actions" reading like iOS Mail/Photos
 *       toolbars rather than "search-first" pattern.
 *     - Search still pushes to /notices/search (NOT inline TextInput) —
 *       rn-screens 4.19 doesn't wire keyboard avoidance for UITabAccessory
 *       (verified on feat/notices-search-prototype 2026-04-26).
 *     - Filter uses `FunnelSimpleIcon` (3 horizontal lines decreasing —
 *       SF Symbol `line.3.horizontal.decrease.circle` shape) instead of
 *       cone-shaped `FunnelIcon` for cleaner visual balance with text.
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

const ICON_SIZE = 20;

export function NoticesAccessoryBar() {
  const { t } = useT();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push('/notices/search')}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.search')}
      >
        <MagnifyingGlassIcon size={ICON_SIZE} color={SdsColors.grey700} />
        <Text style={styles.label}>{t('notices.accessory.search')}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        onPress={() => router.push('/notices/saved')}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.bookmark')}
      >
        <BookmarkSimpleIcon size={ICON_SIZE} color={SdsColors.grey700} />
        <Text style={styles.label}>{t('notices.accessory.bookmark')}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        onPress={() => {
          // TODO: present filter sheet (sort + filter combined)
        }}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.filter')}
      >
        <FunnelSimpleIcon size={ICON_SIZE} color={SdsColors.grey700} />
        <Text style={styles.label}>{t('notices.accessory.filter')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // `space-evenly` distributes free space across all 6 boundaries equally
  // (edge↔A1, A1↔D1, D1↔A2, A2↔D2, D2↔A3, A3↔edge). With each action sized
  // to its natural content width, divider-to-content distance is uniform
  // even when label widths differ ("검색" 2ch vs "보관함" 3ch). flex:1 +
  // justifyContent:center on actions would equalize slot widths but leave
  // wider middle content visibly closer to its dividers — the asymmetry we
  // want to remove.
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 4,
  },
  actionPressed: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    color: SdsColors.grey800,
    fontWeight: '500',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: SdsColors.grey300,
  },
});
