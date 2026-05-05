/**
 * iOS<26 / Android fallback search-entry bar for the Notices tab.
 *
 * Rationale: iOS 26 NativeTabs `bottomAccessory` (NoticesAccessoryBar with
 * Liquid Glass capsule) only mounts when `Platform.OS === 'ios' &&
 * isLiquidGlassAvailable()` — see `app/(tabs)/_layout.tsx:150`. iOS<26 +
 * Android fall through to the JSX `<Tabs>` path which has no accessory
 * slot, leaving the search entry without UI. This component fills that gap
 * with a screen-anchored capsule.
 *
 * Mount site: `app/(tabs)/notices/index.tsx` body branch (post-onboarding-
 * gate). Conditional on `!GLASS_AVAILABLE`. See plan
 * `~/.claude/plans/ios26-nifty-umbrella.md`.
 *
 * Why not mount in `(tabs)/_layout.tsx`: NativeTabs path uses bottomAccessory;
 * JSX <Tabs> path has no equivalent slot — outer chrome can't host a
 * per-screen overlay without leaking to other tabs. Mounting inside
 * notices/index.tsx body branch automatically suppresses the bar on the
 * `/notices/search` route (different screen) and on the onboarding gate
 * (different branch).
 *
 * iOS 26 safety: `!GLASS_AVAILABLE` is false on iOS 26, so this component
 * never mounts there — chain-root rule (RNSScreen subviews[0] must be the
 * SectionList/FlatList) is preserved because Fragment-as-parent emits no
 * native view and the third child stays unrendered.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';

const ICON_SIZE = 20;
const CAPSULE_HEIGHT = 52;
const HORIZONTAL_INSET = 16;
// react-navigation/bottom-tabs 7.x BottomTabView is a flex column where the
// tab bar (position: undefined → static, see BottomTabBar.tsx:373) consumes
// its own height inside the layout flow, and MaybeScreenContainer (flex: 1)
// holds the screen content above it. So a `position: 'absolute'` child
// inside the screen has its `bottom: 0` aligned to the tab bar's visual top
// edge — NOT the absolute screen bottom. Adding tab bar height
// (useBottomTabBarHeight or safeArea+49) double-counts the inset and the
// capsule floats ~80pt too high. We just need the gap above the tab bar.
// Same pattern as RefreshFab.tsx:34 (banner offset only, not tab bar).
const BOTTOM_GAP = 8;

export function NoticesSearchFallbackBar() {
  const { t } = useT();
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: BOTTOM_GAP }]}>
      <Pressable
        onPress={() => router.push('/notices/search')}
        style={({ pressed }) => [
          styles.capsule,
          pressed && styles.capsulePressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('notices.accessory.searchPlaceholder')}
      >
        <View style={styles.iconLeft} pointerEvents="none">
          <MagnifyingGlassIcon size={ICON_SIZE} color={SdsColors.grey700} />
        </View>
        <Text style={styles.label}>
          {t('notices.accessory.searchPlaceholder')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: HORIZONTAL_INSET,
    right: HORIZONTAL_INSET,
  },
  capsule: {
    height: CAPSULE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CAPSULE_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  capsulePressed: {
    opacity: 0.6,
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
