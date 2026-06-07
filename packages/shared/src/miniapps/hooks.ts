/**
 * React Query hooks over the mini-app repository. `initialData` from the sync
 * bundled read means the local era renders with no loading flicker; when the
 * repository goes remote, drop `initialData`/lower `staleTime` and call sites
 * stay identical.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getMiniAppDetailSync,
  getMiniAppIndexSync,
  miniAppRepository,
} from './repository';

export const MINIAPP_INDEX_KEY = ['miniapp', 'index'] as const;
export const miniAppDetailKey = (id: string) => ['miniapp', 'detail', id] as const;

export function useMiniAppIndex() {
  return useQuery({
    queryKey: MINIAPP_INDEX_KEY,
    queryFn: () => miniAppRepository.getIndex(),
    initialData: getMiniAppIndexSync,
    staleTime: Infinity,
  });
}

export function useMiniAppDetail(id: string | undefined) {
  return useQuery({
    queryKey: miniAppDetailKey(id ?? ''),
    queryFn: () => miniAppRepository.getDetail(id as string),
    enabled: !!id,
    initialData: id ? () => getMiniAppDetailSync(id) : undefined,
    staleTime: Infinity,
  });
}
