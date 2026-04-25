import { Redirect } from 'expo-router';

/**
 * Root path redirect — `/` → `/(tabs)/home`.
 *
 * After moving the home tab from `app/(tabs)/index.tsx` to
 * `app/(tabs)/home/index.tsx` (URL = `/home`), the bare `/` URL no longer
 * matched any route. This caused "page not found" errors when:
 *   - SDUI configs send `actionType: 'route', actionValue: '/'`
 *     → handleSduiAction calls `router.push('/')`
 *   - External `skkuverse://` deep link with empty path
 *   - Any other code that navigates to `/`
 *
 * This file catches all those cases and redirects to the home tab.
 * Belt-and-suspenders alongside `+native-intent.tsx` which redirects
 * `/` system paths at the OS-intent layer.
 */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
