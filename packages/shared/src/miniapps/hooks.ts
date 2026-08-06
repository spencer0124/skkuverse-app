/**
 * React Query hooks over the mini-app repository.
 *
 * `initialData` comes from the MMKV last-known-good cache rather than a bundled
 * JSON read, so a warm start still paints with no loading flicker while the
 * server stays the only source of truth. On a device that has never reached the
 * server there is no initial data — the grid is briefly empty, which is the
 * honest state.
 *
 * `staleTime` is finite (unlike the bundled era's `Infinity`): the registry can
 * now change without an app release, so a long-lived session has to be able to
 * pick that up.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getCachedMiniAppDetail,
  getCachedMiniAppIndex,
  miniAppRepository,
} from './repository';

/** 5 minutes — a mini-app edit reaches open sessions without hammering the API. */
const REGISTRY_STALE_TIME = 5 * 60 * 1000;

export const MINIAPP_INDEX_KEY = ['miniapp', 'index'] as const;
export const miniAppDetailKey = (id: string) =>
  ['miniapp', 'detail', id] as const;

export function useMiniAppIndex() {
  return useQuery({
    queryKey: MINIAPP_INDEX_KEY,
    queryFn: () => miniAppRepository.getIndex(),
    // MUST return undefined (not []) on a cache miss. React Query stamps
    // `initialData` as freshly fetched, so an empty array plus a non-zero
    // staleTime reads as "we have the registry, it's just empty" and NO request
    // is ever made — the grid stays blank for the whole staleTime window.
    // undefined means "nothing yet", which is what actually sends the request.
    //
    // The bundled-registry version couldn't hit this: its initialData always
    // had four entries, so the same suppressed fetch was invisible.
    initialData: () => {
      const cached = getCachedMiniAppIndex();
      return cached.length > 0 ? cached : undefined;
    },
    // Backdate the cached copy so it paints instantly but still revalidates
    // right away. Without this, a warm start would show last-known-good and sit
    // on it for staleTime, which is how a removed mini-app would linger.
    initialDataUpdatedAt: 0,
    staleTime: REGISTRY_STALE_TIME,
  });
}

export function useMiniAppDetail(id: string | undefined) {
  return useQuery({
    queryKey: miniAppDetailKey(id ?? ''),
    queryFn: () => miniAppRepository.getDetail(id as string),
    enabled: !!id,
    // Already undefined on a miss, so this one can't suppress its own fetch —
    // but it needs the same backdating so a cached detail revalidates.
    initialData: id ? () => getCachedMiniAppDetail(id) : undefined,
    initialDataUpdatedAt: 0,
    staleTime: REGISTRY_STALE_TIME,
  });
}
