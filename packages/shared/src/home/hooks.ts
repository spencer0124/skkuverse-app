/**
 * React Query hook over the home layout.
 *
 * Seeded from the MMKV cache and backdated, exactly like `useMiniAppIndex`:
 * paints instantly on a warm start, revalidates right away. `data` is
 * undefined until something usable exists — the home screen draws its own
 * default layout for that case.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchHomeLayout, getCachedHomeLayout } from './repository';

/** 5 minutes — the server's Cache-Control on the same response. */
const LAYOUT_STALE_TIME = 5 * 60 * 1000;

export const HOME_LAYOUT_KEY = ['home', 'layout'] as const;

export function useHomeLayout() {
  return useQuery({
    queryKey: HOME_LAYOUT_KEY,
    queryFn: fetchHomeLayout,
    initialData: getCachedHomeLayout,
    initialDataUpdatedAt: 0,
    staleTime: LAYOUT_STALE_TIME,
  });
}
