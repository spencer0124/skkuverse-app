/**
 * A festival place's detail, keyed by the id its pin carries.
 *
 * **Served from a mock, in development builds only.** The server has no field
 * for any of `PlaceDetail` yet, so this hook exists to give the sheet its final
 * data flow now: when the server grows the shape, the lookup below is the one
 * thing that changes — whether that becomes a request or a read off the overlay
 * the pin already carries.
 *
 * `null` is an answer, not a failure: it is what every place without a detail
 * resolves to, and the sheet draws its base skeleton for it. A release build
 * resolves every place to `null`, which is exactly the sheet those builds show
 * today plus the new layout.
 *
 * `initialData` rather than an async `queryFn` alone, because the mock is
 * synchronous and the sheet is already rising when this is first read — an
 * async resolve would draw the base skeleton for a frame and then jump.
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_PLACE_DETAILS } from '../map/mock/placeDetails';
import type { PlaceDetail } from '../types/placeDetail';

export const PLACE_DETAIL_KEY = ['eventmap', 'place', 'detail'] as const;

/**
 * The mock switch. `__DEV__` and nothing wider: the mock's keys are the real
 * slug scheme, so on the beta channel — which sees the real festival the moment
 * the server opens it — they would dress real pins in 2025's text.
 */
const PLACE_DETAIL_MOCK = __DEV__;

function lookup(placeId: string): PlaceDetail | null {
  return PLACE_DETAIL_MOCK ? (MOCK_PLACE_DETAILS[placeId] ?? null) : null;
}

export function usePlaceDetail(placeId: string | null) {
  return useQuery<PlaceDetail | null>({
    queryKey: [...PLACE_DETAIL_KEY, placeId],
    queryFn: async () => (placeId === null ? null : lookup(placeId)),
    initialData: () => (placeId === null ? undefined : lookup(placeId)),
    enabled: placeId != null,
    staleTime: Infinity,
  });
}
