/**
 * Default campus sections — what the campus sheet shows when the API fails.
 *
 * **Deliberately empty.** The sheet is a promo feed on a floating glass card
 * over the map, and a stale promo is worse than no promo: an empty card is a
 * legitimate resting state for this surface in a way an empty notices tab is
 * not. Nothing here is load-bearing for navigation, so there is nothing a
 * fallback has to keep reachable.
 *
 * This used to be a hardcoded four-item button grid, and twice that was a bug
 * rather than a safety net. `building_map` pointed at the webview map long
 * after the server had switched to `route` → /map/hssc, so an API failure
 * resurrected a dead screen; `lost_found` named an older webview deployment in
 * hash form long after the server moved to path routing, caught just before it
 * fired (skkuverse#46). The lesson generalises: **a fallback that disagrees
 * with the server only ever surfaces when nobody is looking.** Keeping this
 * empty is what makes that class of bug unrepresentable.
 *
 * The consequence to keep in mind: `useCampusSections` still never throws, so
 * a dead API and a server that legitimately has nothing to show are now
 * indistinguishable to the caller. That is the intended trade for this surface.
 */

import type { CampusSectionsResponse } from '../types/sdui';

export const DEFAULT_CAMPUS_SECTIONS: CampusSectionsResponse = {
  sections: [],
  minAppVersion: null,
};
