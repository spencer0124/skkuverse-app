/**
 * Open the campus map on one place, from anywhere in the app.
 *
 * The same route a `skkuverse://map?place=` link takes — stash the reference,
 * land on the campus tab — so there is one resolver for both: CampusScreen
 * consumes `pendingMapPlaceLink`, waits for the event markers to settle, and
 * opens the place's sheet. An id that matches nothing lands on the campus tab
 * with no sheet, never an error.
 *
 * `dismissTo`, not `push`: the caller is usually a web shell (`/webview`,
 * `/mini-app`) sitting on the root stack above the tabs, and the map should
 * REPLACE it, not stack a second copy of the tabs on top. `dismissTo` pops back
 * to `(tabs)` and switches to the campus tab, the same call the action handler
 * already makes for `/`.
 *
 * The reference is set BEFORE navigating. When CampusScreen is already mounted
 * under the shell, its subscriber runs synchronously here and can cancel the
 * round-trip restore of the sheet the user left from, before the return focus
 * would raise it.
 */
import { router } from 'expo-router';
import type { MapPlaceRef } from '@skkuverse/shared';
import { pendingMapPlaceLink } from './pending-map-place-link';

export function openMapAtPlace(ref: MapPlaceRef): void {
  pendingMapPlaceLink.set(ref);
  router.dismissTo('/(tabs)/campus' as never);
}
