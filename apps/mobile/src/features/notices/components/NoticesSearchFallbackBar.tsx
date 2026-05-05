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

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';

const ICON_SIZE = 20;
const CAPSULE_HEIGHT = 52;
const HORIZONTAL_INSET = 16;
// JSX <Tabs> path uses react-navigation/bottom-tabs default chrome height
// (49pt iOS, 56pt Android). `(tabs)/_layout.tsx`'s tabBarStyle sets only
// backgroundColor + borderTop — no height override, so these defaults hold.
// `useBottomTabBarHeight()` was tried first but returned a value larger than
// the visual chrome on iOS 18 (likely double-counts inset under expo-router's
// Tabs wrapper), pushing the capsule too high; computing from
// safeAreaInsets + a known chrome constant is exact.
const TAB_BAR_CHROME = Platform.select({
  ios: 49,
  android: 56,
  default: 49,
})!;
const BOTTOM_GAP = 8;

export function NoticesSearchFallbackBar() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + TAB_BAR_CHROME + BOTTOM_GAP;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
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
