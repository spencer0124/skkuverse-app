/**
 * Home tab — main dashboard with search, profile, quick actions, and grid menu.
 * Mockup-only: no API connections, all data is hardcoded.
 *
 * Currently disabled — hidden from tab bar via href: null in _layout.tsx.
 */

// import { HomeScreen } from '@/features/home/HomeScreen';

import { Redirect } from 'expo-router';

export default function HomeTab() {
  // return <HomeScreen />;
  return <Redirect href="/(tabs)/campus" />;
}
