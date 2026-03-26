import { Stack } from 'expo-router';

/**
 * Bus screen group layout — wraps /bus/realtime and /bus/schedule.
 */
export default function BusLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
