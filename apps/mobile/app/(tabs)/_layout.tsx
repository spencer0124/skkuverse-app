import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
import type { NavigationState } from "@react-navigation/native";
import {
  HouseIcon,
  BellIcon,
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

/** Map persisted TabRoute → expo-router screen name (index.tsx is 'index'). */
function tabRouteToScreen(tab: TabRoute): string {
  return tab === 'home' ? 'index' : tab;
}

/** Map expo-router screen name → persisted TabRoute. */
function screenToTabRoute(name: string): TabRoute | null {
  if (name === 'index') return 'home';
  if (name === 'campus' || name === 'transit' || name === 'notices') return name;
  return null;
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
      >
        <NativeTabs.Trigger name="index">
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
              default: require('../../assets/tab-icons/bell-outline.png'),
              selected: require('../../assets/tab-icons/bell-filled.png'),
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
        name="index"
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
            <BellIcon size={22} color={color} weight={focused ? "fill" : "regular"} />
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
