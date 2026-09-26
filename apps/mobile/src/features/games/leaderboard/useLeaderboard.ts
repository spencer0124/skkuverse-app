import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthStore } from '@skkuverse/shared';
import type { NativeGameId } from '../ids';
import { NATIVE_GAMES } from '../registry';
import type { BoardEntry } from './domain';
import { myEntry, rankOf, topEntries } from './repository';

/**
 * Leaderboard reads, shared by the result screen, the home section and the
 * full board. Every key starts with ['leaderboard', gameId], so one
 * invalidation after a write refreshes them all.
 */
const STALE_MS = 30_000;

const orderOf = (gameId: NativeGameId) => NATIVE_GAMES[gameId].score.order;

export const leaderboardKey = (gameId: NativeGameId) => ['leaderboard', gameId] as const;

/**
 * `refetchOnMount: false` for a board that mounts again and again without the
 * player asking — the home carousel mounts a page on every turn, and each
 * mount of stale data would otherwise read the board again.
 */
export interface BoardReadOptions {
  refetchOnMount?: boolean;
}

/** Reading needs a signed-in user (anonymous is enough); before that, it waits. */
export function useBoardTop(gameId: NativeGameId, limit: number, options: BoardReadOptions = {}) {
  const signedIn = useAuthStore((s) => s.uid !== null);
  return useQuery({
    queryKey: [...leaderboardKey(gameId), 'top', limit],
    enabled: signedIn,
    queryFn: () => topEntries(gameId, orderOf(gameId), limit),
    staleTime: STALE_MS,
    refetchOnMount: options.refetchOnMount ?? true,
  });
}

/** The signed-in player's best with its rank; null data when they have none. */
export function useMyBest(gameId: NativeGameId, uid: string | null, options: BoardReadOptions = {}) {
  return useQuery({
    queryKey: [...leaderboardKey(gameId), 'me', uid],
    enabled: uid !== null,
    queryFn: async (): Promise<{ entry: BoardEntry; rank: number } | null> => {
      const entry = await myEntry(gameId, uid!);
      return entry ? { entry, rank: await rankOf(gameId, orderOf(gameId), entry.score) } : null;
    },
    staleTime: STALE_MS,
    refetchOnMount: options.refetchOnMount ?? true,
  });
}

/** Where a score not on the board (yet) would rank. */
export function useRankOf(gameId: NativeGameId, score: number | null) {
  return useQuery({
    queryKey: [...leaderboardKey(gameId), 'rank', score],
    enabled: score !== null && score > 0,
    queryFn: () => rankOf(gameId, orderOf(gameId), score!),
    staleTime: STALE_MS,
  });
}

export function useInvalidateLeaderboard(gameId: NativeGameId) {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: leaderboardKey(gameId) }), [queryClient, gameId]);
}
