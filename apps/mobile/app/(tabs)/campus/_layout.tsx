import { Stack } from 'expo-router';

/**
 * Campus tab inner Stack — header hidden statically. CampusScreen draws
 * its own floating search bar + toggle controls over the map. Setting
 * `headerShown: false` at this layout level (vs runtime setOptions on the
 * parent (tabs) screen) means switching tabs does NOT trigger a header
 * toggle, which would otherwise cause content to slide up/down.
 */
export default function CampusStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
