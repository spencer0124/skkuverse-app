import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Skeleton, Txt } from '@skkuverse/sds';
import { SdsColors, useAuthStore, useT } from '@skkuverse/shared';
import type { NativeGameId } from '../ids';
import { NATIVE_GAMES } from '../registry';
import { boardLines, type MyLine } from './domain';
import { BoardHeader, openLeaderboard } from './BoardHeader';
import { LeaderboardList } from './LeaderboardList';
import { useBoardTop, useMyBest } from './useLeaderboard';

interface Props {
  gameId: NativeGameId;
  /** The title row's text; not needed with `showHeader={false}`. */
  title?: string;
  limit?: number;
  /**
   * The player's line. Left out, it is their best on the board when they are
   * signed in (the home section); the result screen passes its own (a ghost
   * for an unsubmitted run, or the entry it just wrote).
   */
  me?: MyLine | null;
  /** Under the list: a rank change note. */
  footer?: ReactNode;
  /** Draw the title row; off where the host screen draws its own (home). */
  showHeader?: boolean;
  /**
   * Home: the top `limit`, then the player's line right under it when they
   * are further down (no "⋯" between), and no read on each remount
   * (useLeaderboard `BoardReadOptions`).
   */
  compact?: boolean;
  /**
   * Home: keep a line's room under the top `limit` even when this game has no
   * player's line there, so every page of the carousel is the same height —
   * set when any game's page has one.
   */
  reserveMine?: boolean;
}

/**
 * A game's board, top N plus the player's line — on the home screen and after
 * a run. It always shows N places: the ones nobody holds yet are drawn blank.
 */
export function LeaderboardTopSection({
  gameId,
  title = '',
  limit = 5,
  me,
  footer,
  showHeader = true,
  compact = false,
  reserveMine = false,
}: Props) {
  const router = useRouter();
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const reads = compact ? { refetchOnMount: false } : {};
  const top = useBoardTop(gameId, limit, reads);
  const myBest = useMyBest(gameId, me === undefined && uid && !isAnonymous ? uid : null, reads);
  const { order, format } = NATIVE_GAMES[gameId].score;

  const mine: MyLine | null = useMemo(() => {
    if (me !== undefined) return me;
    if (!myBest.data) return null;
    return { kind: 'entry', entry: myBest.data.entry, rank: myBest.data.rank };
  }, [me, myBest.data]);

  // Nothing until the top is in: placed against an empty list, the player's
  // line would read as first.
  // Not signed in at all (the anonymous sign-in has not landed): nothing can
  // be read, so the places are drawn empty rather than loading for ever.
  const lines = useMemo(() => {
    const all = top.data
      ? boardLines({ top: top.data, order, limit, me: mine, fill: true })
      : uid === null
        ? boardLines({ top: [], order, limit, me: null, fill: true })
        : [];
    // Home has room for one line under the top, not two.
    return compact ? all.filter((line) => line.kind !== 'gap') : all;
  }, [top.data, order, limit, mine, uid, compact]);
  const compactRows = limit + (reserveMine ? 1 : 0);

  return (
    <View style={styles.section}>
      {showHeader && <BoardHeader title={title} typography="t5" onViewAll={() => openLeaderboard(router, gameId)} />}
      {top.isError ? (
        <Txt typography="t7" color={SdsColors.grey500} style={styles.empty}>
          {t('game.leaderboardError')}
        </Txt>
      ) : lines.length === 0 ? (
        <Skeleton.Animate>
          <View style={styles.skeleton}>
            {/* As tall as the rows that replace it, so the card does not jump. */}
            {Array.from({ length: compact ? compactRows : Math.min(limit, 3) }, (_, i) => (
              <Skeleton key={i} height={ROW_HEIGHT - SKELETON_GAP} borderRadius={12} />
            ))}
          </View>
        </Skeleton.Animate>
      ) : (
        <>
          <LeaderboardList lines={lines} format={format} />
          {compact && lines.length < compactRows && <View style={{ height: ROW_HEIGHT * (compactRows - lines.length) }} />}
        </>
      )}
      {footer}
    </View>
  );
}

/** LeaderboardRow's minimum height. */
const ROW_HEIGHT = 52;
const SKELETON_GAP = 8;

const styles = StyleSheet.create({
  section: { gap: 4 },
  skeleton: { gap: SKELETON_GAP, paddingVertical: SKELETON_GAP / 2 },
  empty: { paddingVertical: 12, textAlign: 'center' },
});
