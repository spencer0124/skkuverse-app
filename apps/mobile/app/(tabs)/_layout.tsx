import { Tabs } from "expo-router";
import type { NavigationState } from "@react-navigation/native";
import { /* Home, */ Map, Navigation, Bell } from "lucide-react-native";
import { Text } from "react-native";
import { useT, useSettingsStore } from "@skkuverse/shared";
import type { TabRoute } from "@skkuverse/shared";
import { logTabSwitch } from "@/services/analytics";

const VALID_TABS: readonly TabRoute[] = ['campus', 'transit', 'notices'];

export default function TabLayout() {
  const { t } = useT();
  const lastTab = useSettingsStore((s) => s.lastTab);
  const setLastTab = useSettingsStore((s) => s.setLastTab);

  const initialTab = VALID_TABS.includes(lastTab) ? lastTab : 'notices';

  return (
    <Tabs
      initialRouteName={initialTab}
      screenListeners={{
        state: (e) => {
          const state = (e.data as { state: NavigationState }).state;
          const route = state.routes[state.index];
          if (
            route?.name === 'campus' ||
            route?.name === 'transit' ||
            route?.name === 'notices'
          ) {
            logTabSwitch(route.name);
            setLastTab(route.name as TabRoute);
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
      {/* <Tabs.Screen
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
      /> */}
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: t("nav.notices"),
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
