import { Stack } from 'expo-router';

/**
 * Transit tab inner Stack — header hidden statically. The bus list view
 * extends edge-to-edge under the status bar, matching the campus tab's
 * floating-UI convention. Setting `headerShown: false` at this layout
 * level (vs runtime setOptions on the parent (tabs) screen) means switching
 * tabs does NOT trigger a header toggle, which would otherwise cause
 * content to slide up/down.
 */
export default function TransitStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
