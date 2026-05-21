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
 * Visual design — single search action centered:
 *   We do NOT wrap children in our own GlassView. iOS 26's UITabAccessory
 *   automatically applies a Liquid Glass material to the entire accessory
 *   area, and that material is forced full-width regardless of contentView
 *   intrinsic size (verified empirically 2026-04-26 — UITabAccessory.h
 *   exposes only contentView/initWithContentView:; no width opt-out).
 *
 *   The previous 3-peer design (search / bookmark / filter) was trimmed
 *   on 2026-05-05 once the bookmark action moved to the top
 *   `unstable_headerRightItems` bar (notices/_layout.tsx) — duplicating
 *   bookmark in two places was redundant. Filter was a TODO that hadn't
 *   shipped, so dropping it eliminates a placeholder. Search remains the
 *   primary on-scroll action.
 *
 *   Layout — icon at left edge, label centered:
 *     ┌──────────────────────────────────────────────────┐
 *     │  🔍                  검색                        │
 *     └──────────────────────────────────────────────────┘
 *     - Pressable spans the full accessory width so the entire bar is the
 *       tap target. Icon is absolute-positioned at the left edge, label
 *       is centered in the row independent of icon width — keeps the
 *       label visually centered on the screen even though the icon is
 *       offset to one side.
 *     - Search still pushes to /notices/search (NOT inline TextInput) —
 *       rn-screens 4.19 doesn't wire keyboard avoidance for UITabAccessory
 *       (verified on feat/notices-search-prototype 2026-04-26).
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
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { useNoticesSearchPlaceholder } from '../hooks/useNoticesSearchPlaceholder';

const ICON_SIZE = 20;

export function NoticesAccessoryBar() {
  const router = useRouter();
  const placeholder = useNoticesSearchPlaceholder();
  return (
    <Pressable
      onPress={() => router.push('/notices/search')}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
    >
      <View style={styles.inner} pointerEvents="none">
        <View style={styles.iconLeft}>
          <MagnifyingGlassIcon size={ICON_SIZE} color={SdsColors.grey700} />
        </View>
        <Text style={styles.label}>{placeholder}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full-width tap area. UITabAccessory's contentView is always full-width
  // (forced by iOS). Inner box clamps the visual icon+label group so on iPad
  // the icon doesn't drift to the screen edge while the label sits at center.
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPressed: {
    opacity: 0.5,
  },
  iconLeft: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    color: SdsColors.grey800,
    fontWeight: '500',
  },
});
