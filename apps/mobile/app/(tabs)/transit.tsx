import { View, Text, StyleSheet } from "react-native";

export default function TransitScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>이동</Text>
      <Text style={styles.subtitle}>Transit info will be here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#191F28",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#8B95A1",
  },
});
