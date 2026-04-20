import { Tabs } from "expo-router";
import type { NavigationState } from "@react-navigation/native";
import { Home, Map, Navigation, Bell } from "lucide-react-native";
import { Text } from "react-native";
import { useT, useSettingsStore, useNotificationStore } from "@skkuverse/shared";
import type { TabRoute } from "@skkuverse/shared";
import { logTabSwitch } from "@/services/analytics";

const VALID_TABS: readonly TabRoute[] = ['home', 'campus', 'transit', 'notices'];

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

  const initialTab: TabRoute = VALID_TABS.includes(lastTab) ? lastTab : 'notices';

  // tabBarBadge expects number | string | undefined; 0/null hide the badge
  // but falsy numbers still render in some RN versions — use undefined.
  const noticesBadge: number | string | undefined =
    unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined;

  return (
    <Tabs
      initialRouteName={tabRouteToScreen(initialTab)}
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
        tabBarActiveTintColor: "#191F28",
        tabBarInactiveTintColor: "#B0B8C1",
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
          tabBarIcon: ({ color }) => (
            <Home size={22} color={color} />
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
          tabBarIcon: ({ color }) => (
            <Bell size={22} color={color} />
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
          tabBarIcon: ({ color }) => (
            <Map size={22} color={color} />
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
          tabBarIcon: ({ color }) => (
            <Navigation size={22} color={color} />
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
