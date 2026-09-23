/**
 * Every festival place's detail, keyed by the id its pin's tap carries.
 *
 * One request for the whole festival, `GET /map/overlays/event/details`, made
 * beside the overlays rather than when a sheet rises: the response is ~20 KB,
 * and fetched up front a tapped pin's sheet opens with its menu already in it
 * instead of drawing its skeleton and then growing under the finger.
 *
 * The route is the overlay endpoint's `/details`, and `null` disables the query.
 * So the festival gate closes this with no second guard: when `withoutFestival`
 * strips the festival layers there is no endpoint to read, and nothing is asked
 * for — the same way the overlays themselves stay unrequested.
 *
 * A failure is not surfaced. A place without a detail is an ordinary answer
 * (the sheet draws its hours and actions from the overlay alone), so a failed
 * request degrades to exactly that rather than to an error state.
 */

import { useQuery } from '@tanstack/react-query';
import { safeGet } from '../api/safe-request';
import { parsePlaceDetails } from '../map/parser';
import type { PlaceDetail } from '../types/placeDetail';

/** Key PREFIX; the details route is appended, as `MAP_LAYER_OVERLAYS_KEY` does. */
export const PLACE_DETAILS_KEY = ['eventmap', 'place', 'details'] as const;

export function usePlaceDetails(overlayEndpoint: string | null) {
  const endpoint = overlayEndpoint === null ? null : `${overlayEndpoint}/details`;
  return useQuery<Record<string, PlaceDetail>>({
    queryKey: [...PLACE_DETAILS_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint as string, parsePlaceDetails);
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: endpoint !== null,
    // The overlays' own staleness, so a pin and the sheet it opens refresh
    // together rather than a menu outliving the place it describes.
    staleTime: 10 * 60_000,
  });
}
