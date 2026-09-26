import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_AUTO_ROTATE_SEC, useT } from '@skkuverse/shared';
import { LoopingPager } from '@/components/LoopingPager';
import type { NativeGameId } from '../ids';
import { BoardHeader, openLeaderboard } from './BoardHeader';
import { GameChip } from './GameChip';
import { LeaderboardTopSection } from './LeaderboardTopSection';

/** Places per game on home: the podium. The whole board is one tap away ("view all"). */
const HOME_LIMIT = 3;
const SECTION_MARGIN = 16;
const CARD_PADDING = 8;

/**
 * The home screen's Hall of Fame: one card, one page per in-app game — its
 * name, then its top three with the player's own line placed in — turning
 * over like the banner above it (`LoopingPager`, "1 / 2"). "View all" opens
 * the board of the game on screen.
 */
export function HomeHallOfFame({ gameIds }: { gameIds: readonly NativeGameId[] }) {
  const router = useRouter();
  const { t } = useT();
  const [page, setPage] = useState(0);
  const pageKey = gameIds.join('|');

  const renderPage = useCallback(
    (i: number) => {
      const id = gameIds[i]!;
      return (
        <View style={styles.page}>
          <View style={styles.chip}>
            <GameChip gameId={id} />
          </View>
          <LeaderboardTopSection gameId={id} limit={HOME_LIMIT} showHeader={false} compact />
        </View>
      );
    },
    [gameIds],
  );

  if (gameIds.length === 0) return null;
  const current = gameIds[page % gameIds.length]!;
  return (
    <View style={styles.section}>
      <BoardHeader title={t('game.hallOfFame')} typography="t4" onViewAll={() => openLeaderboard(router, current)} />
      <View style={styles.card}>
        <LoopingPager
          pageCount={gameIds.length}
          pageKey={pageKey}
          autoRotateMs={DEFAULT_AUTO_ROTATE_SEC * 1000}
          renderPage={renderPage}
          onPageChange={setPage}
          counter="topRight"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: SECTION_MARGIN, marginBottom: 36, gap: 8 },
  // The padding is on each page, not the card, so pages slide to the card's edge.
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  page: { padding: CARD_PADDING, paddingTop: CARD_PADDING + 2 },
  chip: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
});
