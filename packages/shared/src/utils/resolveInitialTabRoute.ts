import type { TabRoute } from '../store/settings';

const VALID_TABS: readonly TabRoute[] = ['home', 'campus', 'transit', 'notices'];

/**
 * Pure mapper — translates a (potentially invalid/missing) persisted lastTab
 * value into the expo-router screen name to use as the tabs layout's initial
 * route. Returns 'index' for the home tab (since app/(tabs)/index.tsx is the
 * home file) or the tab name otherwise. Falls back to 'index' (home) for any
 * value not in the VALID_TABS whitelist.
 *
 * Used by mobile's app/(tabs)/_layout.tsx for unstable_settings resolution.
 * Kept pure (no Zustand / MMKV access) so it's vitest-testable here.
 */
export function resolveInitialTabRouteName(lastTab: unknown): string {
  if (typeof lastTab === 'string' && (VALID_TABS as readonly string[]).includes(lastTab)) {
    return lastTab === 'home' ? 'index' : lastTab;
  }
  return 'index';
}
