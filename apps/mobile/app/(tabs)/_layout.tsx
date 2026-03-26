import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#191F28",
        tabBarInactiveTintColor: "#B0B8C1",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E8EB",
          borderTopWidth: 0.5,
          height: 52 + 34, // 52px content + safe area (estimated)
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "캠퍼스",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? "map" : "map"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transit"
        options={{
          title: "이동",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? "near-me" : "near-me"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
