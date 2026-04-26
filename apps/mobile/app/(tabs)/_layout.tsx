import { Tabs, useSegments } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
import type { NavigationState } from "@react-navigation/native";
import {
  HouseIcon,
  MegaphoneSimpleIcon,
  CompassIcon,
  PathIcon,
} from "phosphor-react-native";
import { Platform, Text } from "react-native";
import {
  useT,
  useSettingsStore,
  useNotificationStore,
  resolveInitialTabRouteName,
} from "@skkuverse/shared";
import type { TabRoute } from "@skkuverse/shared";
import { logTabSwitch } from "@/services/analytics";
import { NoticesAccessoryBar } from "@/features/notices/components/NoticesAccessoryBar";

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
 * only when (a) inline placement (= tab bar minimized by scroll) AND
 * (b) the focused route is the notices tab root (not a pushed detail).
 *
 * useSegments() works here because this component mounts inside the
 * NativeTabs subtree which lives under (tabs)/_layout.tsx in the expo-router
 * tree — full router context available.
 *
 * Requires patches/expo-router+6.0.23.patch (forwards bottomAccessory) and
 * patches/react-native-screens+4.19.0.patch (KVO removeObserver swallow).
 * On Expo SDK 55+ migration, replace the callback prop on <NativeTabs>
 * below with the <NativeTabs.BottomAccessory> wrapper component.
 */
function NoticesBottomAccessoryGate({ env }: { env: 'regular' | 'inline' }) {
  const segments = useSegments();
  if (env !== 'inline') return null;
  const isNoticesRoot =
    segments[0] === '(tabs)' &&
    segments[1] === 'notices' &&
    (segments.length === 2 || segments[2] === 'index');
  if (!isNoticesRoot) return null;
  return <NoticesAccessoryBar />;
}

export default function TabLayout() {
  const { t } = useT();
  const lastTab = useSettingsStore((s) => s.lastTab);
  const setLastTab = useSettingsStore((s) => s.setLastTab);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const initialTab: TabRoute = VALID_TABS.includes(lastTab) ? lastTab : 'home';
  const initialRouteName = tabRouteToScreen(initialTab);

  // tabBarBadge expects number | string | undefined; 0/null hide the badge
  // but falsy numbers still render in some RN versions — use undefined.
  const noticesBadge: number | string | undefined =
    unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined;

  // iOS: native tab bar (UITabBarController). On iOS 26 the system renders
  // the new Liquid Glass material automatically — no extra prop required.
  // Per-screen tab_switch tracking moves to useTabFocusTracking inside each
  // tab screen component (NativeTabs doesn't expose screenListeners).
  // initialRouteName is set via the unstable_settings export above.
  if (Platform.OS === 'ios') {
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
        // `docs/ios-26-native-tabs-minimize.md`.
        minimizeBehavior="onScrollDown"
        // bottomAccessory: requires patches/expo-router+6.0.23.patch (forwards
        // prop to react-native-screens BottomTabs) and patches/
        // react-native-screens+4.19.0.patch (RNSBottomAccessoryHelper KVO
        // swallow). SDK 55+ migration → switch to <NativeTabs.BottomAccessory>
        // wrapper + delete both patches. See NoticesAccessoryBar.tsx docstring.
        bottomAccessory={(env) => <NoticesBottomAccessoryGate env={env} />}
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
