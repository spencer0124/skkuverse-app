import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text } from "react-native";

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
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "캠퍼스",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="map" size={22} color={color} />
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
              캠퍼스
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="transit"
        options={{
          title: "이동",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="near-me" size={22} color={color} />
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
              이동
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
