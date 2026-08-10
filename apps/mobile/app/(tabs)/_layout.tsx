import { Tabs, useSegments, useNavigation } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
import type { NavigationState } from "@react-navigation/native";
import { useEffect } from "react";
import {
  HouseIcon,
  MegaphoneSimpleIcon,
  CompassIcon,
  PathIcon,
} from "phosphor-react-native";
import { Platform, Text } from "react-native";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import {
  useT,
  useAuthStore,
  useSettingsStore,
  useNotificationStore,
  resolveInitialTabRouteName,
} from "@skkuverse/shared";
import type { TabRoute } from "@skkuverse/shared";
import { logTabSwitch } from "@/services/analytics";
import { NoticesAccessoryBar } from "@/features/notices/components/NoticesAccessoryBar";

// iOS 26+ only. False on iOS < 26 and on Android — the single predicate
// that gates NativeTabs (vs JSX <Tabs>) and useTabFocusTracking
// (vs <Tabs screenListeners>). Module-scope is the project idiom; see
// AccountSettingsScreen.tsx, RefreshFab.tsx, SearchBar.tsx, HeaderIconButton.tsx.
const GLASS_AVAILABLE = isLiquidGlassAvailable();

// `unstable_settings.initialRouteName` is consumed at module evaluation time
// by expo-router's getRoutesCore. We read MMKV-backed lastTab synchronously
// (Zustand+MMKV is fully sync — no try/catch / no race), and resolve via the
// shared pure mapper which has its own vitest coverage.
export const unstable_settings = {
  initialRouteName: resolveInitialTabRouteName(
    useSettingsStore.getState().lastTab,
  ),
};

const VALID_TABS: readonly TabRoute[] = ['home', 'campus', 'transit', 'notices'];

// Toss-style tab bar — inactive = lucide outline @ gray, active = filled
// silhouette @ dark. Both variants are pre-baked PNGs (see export-tab-icons.mjs);
// the iconColor prop tints the bundled image via UITabBarItem template
// rendering on iOS. Even if template tint doesn't apply, the active state
// remains visually distinct from inactive thanks to the outline → filled
// silhouette swap.
const ICON_ACTIVE = "#191F28";
const ICON_INACTIVE = "#B0B8C1";

/** Map persisted TabRoute → expo-router screen name. All four tabs are
 *  directories with their own nested Stack; URL = '/home', '/campus', etc. */
function tabRouteToScreen(tab: TabRoute): string {
  return tab;
}

/** Map expo-router screen name → persisted TabRoute. */
function screenToTabRoute(name: string): TabRoute | null {
  if (name === 'home' || name === 'campus' || name === 'transit' || name === 'notices') {
    return name;
  }
  return null;
}

/**
 * iOS 26 NativeTabs bottom accessory gate. Renders <NoticesAccessoryBar/>
 * in BOTH 'regular' and 'inline' placements (so the search/filter UI is
 * visible whether the tab bar is expanded or scroll-minimized) when at the
 * notices tab root (not a pushed detail).
 *
 * The notices-tab guard is handled by the PARENT — TabLayout passes
 * `bottomAccessory={undefined}` for non-notices tabs so this component
 * never mounts there. iOS 26 UITabAccessory is fully unmounted on tab
 * switch (rn-screens calls `setBottomAccessory:nil animated:YES` —
 * RNSBottomTabsHostComponentView.mm:213). This gate only filters one
 * remaining case: root-vs-detail-push.
 *
 * Requires patches/expo-router+6.0.23.patch (forwards bottomAccessory) and
 * patches/react-native-screens+4.19.0.patch (KVO removeObserver swallow).
 * On Expo SDK 55+ migration, replace the callback prop on <NativeTabs>
 * below with the <NativeTabs.BottomAccessory> wrapper component.
 */
function NoticesBottomAccessoryGate() {
  const segments = useSegments();
  // Parent guarantees segments[1] === 'notices' AND that the user has
  // onboarded (auth/onboarding gate is hoisted to TabLayout so the prop
  // itself goes undefined when gated — returning null from here would
  // leave an empty Liquid Glass capsule because UITabAccessory has no
  // opt-out once attached). We only filter pushed detail screens — typed
  // routes collapse `index.tsx` so root has segments.length === 2
  // (segments[2] undefined); a pushed [articleNo] adds a third segment.
  if (segments.length > 2) return null;
  return <NoticesAccessoryBar />;
}

export default function TabLayout() {
  const { t } = useT();
  const lastTab = useSettingsStore((s) => s.lastTab);
  const setLastTab = useSettingsStore((s) => s.setLastTab);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  // Drives conditional bottomAccessory mount. useSegments is reactive — pulls
  // from useRouteInfo (expo-router/build/hooks.js) which updates on tab
  // switch, causing NativeTabs to re-render with prop toggled. rn-screens
  // animates setBottomAccessory:nil on unmount (animated:YES) so transition
  // between tabs is smooth.
  // Widened on purpose. The inferred type comes from .expo/types/router.d.ts,
  // which only Metro generates and .gitignore excludes, so on a clean checkout
  // this infers a 1-tuple and every segments[1] read below fails to compile.
  // Annotating rather than passing a type argument, because the hook's
  // constraint is itself that generated tuple and string[] does not satisfy it.
  // Reading positions as plain strings is what this code actually does.
  const segments: string[] = useSegments();
  const isNoticesTab =
    segments[0] === '(tabs)' && segments[1] === 'notices';
  // Auth/onboarding gate must be evaluated at THIS level so the
  // `bottomAccessory` prop becomes undefined when gated — otherwise the
  // empty Liquid Glass capsule reserves space above the tab bar even if
  // the inner render returns null (UITabAccessory.h has no opt-out).
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const showNoticesAccessory =
    isNoticesTab && !isAnonymous && onboardingCompleted;

  const initialTab: TabRoute = VALID_TABS.includes(lastTab) ? lastTab : 'home';
  const initialRouteName = tabRouteToScreen(initialTab);

  // useNavigation() here resolves to the root Stack (TabLayout is the (tabs)
  // screen body; NativeTabs context isn't pushed until JSX returns), so
  // setOptions sets root Stack's (tabs) entry title for iOS long-press
  // back-history. Cold-start window covered by static fallback in app/_layout.tsx.
  const navigation = useNavigation();
  const activeTabKey: TabRoute =
    segments[0] === '(tabs)' && VALID_TABS.includes(segments[1] as TabRoute)
      ? (segments[1] as TabRoute)
      : initialTab;

  useEffect(() => {
    navigation.setOptions({ title: t(`nav.${activeTabKey}`) });
  }, [activeTabKey, t, navigation]);

  // tabBarBadge expects number | string | undefined; 0/null hide the badge
  // but falsy numbers still render in some RN versions — use undefined.
  const noticesBadge: number | string | undefined =
    unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined;

  // iOS 26+ only: native tab bar (UITabBarController) with Liquid Glass
  // material auto-applied by the OS. Earlier iOS versions and Android fall
  // through to the JSX <Tabs> path below — UIKit's default
  // UITabBarAppearance.scrollEdgeAppearance is transparent on iOS < 26, so
  // letting those devices render <Tabs> with an opaque tabBarStyle is the
  // simplest way to keep content from bleeding under the bar. Per-screen
  // tab_switch tracking happens in useTabFocusTracking (NativeTabs doesn't
  // expose screenListeners); the hook mirrors GLASS_AVAILABLE so iOS < 26
  // doesn't double-track via screenListeners + useFocusEffect.
  // initialRouteName is set via the unstable_settings export above.
  if (Platform.OS === 'ios' && GLASS_AVAILABLE) {
    return (
      <NativeTabs
        iconColor={{ default: ICON_INACTIVE, selected: ICON_ACTIVE }}
        labelStyle={{
          default: { color: ICON_INACTIVE },
          selected: { color: ICON_ACTIVE },
        }}
        // iOS 26+ tab bar collapses on scroll-down. Chain-root rule:
        // every tab screen must return a ScrollView/SectionList/FlatList
        // as the screen root (or first Fragment child). Outer wrapping
        // <View> blocks the native discovery — see
        // `docs/explanation/ios-26-native-tabs-minimize.md`.
        minimizeBehavior="onScrollDown"
        // bottomAccessory: requires patches/expo-router+6.0.23.patch (forwards
        // prop to react-native-screens BottomTabs) and patches/
        // react-native-screens+4.19.0.patch (RNSBottomAccessoryHelper KVO
        // swallow). SDK 55+ migration → switch to <NativeTabs.BottomAccessory>
        // wrapper + delete both patches. See NoticesAccessoryBar.tsx docstring.
        //
        // FOOTGUN: if the accessory silently disappears after a `yarn
        // install` / `expo prebuild --clean`, patch-package likely didn't
        // run (e.g. `--ignore-scripts`). Verify with:
        //   grep -c "bottomAccessory={props?.bottomAccessory}" \
        //     node_modules/expo-router/build/native-tabs/NativeBottomTabs/NativeTabsView.js
        // Expect 1; if 0, rerun `yarn install` (or `npx patch-package`)
        // from the repo root. The JS patch reaches users via OTA; the .mm
        // patch needs a native rebuild to land.
        //
        // Conditional pass: when not on the notices tab, prop is undefined →
        // BottomTabs.tsx skips rendering <BottomTabsAccessory> →
        // RNSBottomTabsHostComponentView.mm:213 calls setBottomAccessory:nil
        // animated:YES → empty Liquid Glass capsule disappears with slide
        // animation. iOS forces glass on UITabAccessory whenever attached;
        // toggling the React subtree is the only way to truly hide it
        // (UITabAccessory.h has no opt-out — verified against iOS 26 SDK).
        bottomAccessory={
          showNoticesAccessory ? () => <NoticesBottomAccessoryGate /> : undefined
        }
      >
        <NativeTabs.Trigger name="home">
          <Icon
            src={{
              default: require('../../assets/tab-icons/home-outline.png'),
              selected: require('../../assets/tab-icons/home-filled.png'),
            }}
          />
          <Label>{t("nav.home")}</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="notices">
          <Icon
            src={{
              default: require('../../assets/tab-icons/megaphone-simple-outline.png'),
              selected: require('../../assets/tab-icons/megaphone-simple-filled.png'),
            }}
          />
          <Label>{t("nav.notices")}</Label>
          {unreadCount > 0 && (
            <Badge>{unreadCount > 99 ? '99+' : String(unreadCount)}</Badge>
          )}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="campus">
          <Icon
            src={{
              default: require('../../assets/tab-icons/compass-outline.png'),
              selected: require('../../assets/tab-icons/compass-filled.png'),
            }}
          />
          <Label>{t("nav.campus")}</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="transit">
          <Icon
            src={{
              default: require('../../assets/tab-icons/path-outline.png'),
              selected: require('../../assets/tab-icons/path-filled.png'),
            }}
          />
          <Label>{t("nav.transit")}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  // Android: keep the existing JS-rendered <Tabs> tree unchanged.
  return (
    <Tabs
      initialRouteName={initialRouteName}
      screenListeners={{
        state: (e) => {
          const state = (e.data as { state: NavigationState }).state;
          const route = state.routes[state.index];
          const mapped = route?.name ? screenToTabRoute(route.name) : null;
          if (mapped) {
            logTabSwitch(mapped);
            setLastTab(mapped);
          }
        },
      }}
      screenOptions={{
        tabBarActiveTintColor: ICON_ACTIVE,
        tabBarInactiveTintColor: ICON_INACTIVE,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E8EB",
          borderTopWidth: 0.5,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ focused, color }) => (
            <HouseIcon size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontSize: 10,
                fontWeight: focused ? "500" : "400",
                color,
                lineHeight: 10,
              }}
            >
              {t("nav.home")}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: t("nav.notices"),
          tabBarBadge: noticesBadge,
          tabBarIcon: ({ focused, color }) => (
            <MegaphoneSimpleIcon size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontSize: 10,
                fontWeight: focused ? "500" : "400",
                color,
                lineHeight: 10,
              }}
            >
              {t("nav.notices")}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="campus"
        options={{
          title: t("nav.campus"),
          tabBarIcon: ({ focused, color }) => (
            <CompassIcon size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontSize: 10,
                fontWeight: focused ? "500" : "400",
                color,
                lineHeight: 10,
              }}
            >
              {t("nav.campus")}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="transit"
        options={{
          title: t("nav.transit"),
          tabBarIcon: ({ focused, color }) => (
            <PathIcon size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                fontSize: 10,
                fontWeight: focused ? "500" : "400",
                color,
                lineHeight: 10,
              }}
            >
              {t("nav.transit")}
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
