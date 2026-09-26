import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowClockwiseIcon, XIcon } from 'phosphor-react-native';
import { Button, GLASS_AVAILABLE, GlassCard, IconButton, Txt } from '@skkuverse/sds';
import { SdsColors, useAuthStore, useT } from '@skkuverse/shared';
import type { NativeGameId } from '../ids';
import { NATIVE_GAMES } from '../registry';
import { boardLines, type BoardLine, type MyLine } from './domain';
import { GameChip } from './GameChip';
import { LeaderboardRow } from './LeaderboardRow';
import { useBoardTop, useInvalidateLeaderboard, useMyBest } from './useLeaderboard';

/** Places in the card; home shows fewer (`HomeHallOfFame`). */
const BOARD_SIZE = 10;
/** Clear of a game's floating buttons (40 pt, 8 pt below the inset), as the game's own chrome is. */
const TOP_CLEARANCE = 56;
const MARGIN = 16;
/** A loading or empty board still reads as a card, not a strip. */
const MIN_CARD_HEIGHT = 260;

/**
 * A game's Hall of Fame: the top ten — always ten places, blank where nobody
 * is yet — and the player's line below it when they are further down. A card floating over whatever opened it (the
 * game, paused underneath, or home) — the home card's look, as Liquid Glass on
 * iOS 26+ (`GlassCard`). Sized to its board, up to the screen; a tap outside
 * closes it.
 */
export function LeaderboardScreen({ gameId }: { gameId: NativeGameId }) {
  const router = useRouter();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const game = NATIVE_GAMES[gameId];

  const board = useBoardTop(gameId, BOARD_SIZE);
  const myBest = useMyBest(gameId, uid && !isAnonymous ? uid : null);
  const invalidate = useInvalidateLeaderboard(gameId);
  // One refresh at a time, from the button or a pull. Invalidating refetches
  // the board and the player's line from the server (and every other view of
  // this board, home included), so whatever changed shows here.
  const [refreshing, setRefreshing] = useState<'button' | 'pull' | null>(null);
  const refresh = (from: 'button' | 'pull') => {
    if (refreshing) return;
    setRefreshing(from);
    void invalidate().finally(() => setRefreshing(null));
  };
  const lines = useMemo(() => {
    if (!board.data) return [];
    const me: MyLine | null = myBest.data ? { kind: 'entry', entry: myBest.data.entry, rank: myBest.data.rank } : null;
    return boardLines({ top: board.data, order: game.score.order, limit: BOARD_SIZE, me, fill: true });
  }, [board.data, myBest.data, game.score.order]);

  const close = () => router.back();

  const renderLine = ({ item }: { item: BoardLine }) =>
    item.kind === 'gap' ? (
      <Txt typography="t6" color={SdsColors.grey400} style={styles.gap}>
        ⋯
      </Txt>
    ) : (
      <LeaderboardRow line={item} format={game.score.format} />
    );

  return (
    <View style={styles.root}>
      {/* Lighter over glass, which samples what is behind it — the SDS Sheet's rule. */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_AVAILABLE ? SdsColors.scrimGlass : SdsColors.scrim }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View
        pointerEvents="box-none"
        style={[styles.slot, { top: insets.top + TOP_CLEARANCE, bottom: insets.bottom + MARGIN }]}
      >
        <GlassCard style={styles.card} contentStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.titles}>
              <GameChip gameId={gameId} />
              <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
                {t('game.hallOfFame')}
              </Txt>
            </View>
            <View style={styles.actions}>
              {refreshing === 'button' ? (
                <View style={styles.spinner}>
                  <ActivityIndicator color={SdsColors.grey600} />
                </View>
              ) : (
                <IconButton
                  icon={<ArrowClockwiseIcon size={22} color={SdsColors.grey900} />}
                  onPress={() => refresh('button')}
                  disabled={refreshing !== null}
                  label={t('common.refresh')}
                />
              )}
              <IconButton icon={<XIcon size={22} color={SdsColors.grey900} />} onPress={close} label={t('common.close')} />
            </View>
          </View>
          <FlatList
            data={lines}
            keyExtractor={(line) => line.key}
            renderItem={renderLine}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={() => refresh('pull')}
            refreshing={refreshing === 'pull'}
            ListEmptyComponent={
              <View style={styles.empty}>
                {board.isLoading ? (
                  <ActivityIndicator size="large" color={SdsColors.grey500} />
                ) : board.isError ? (
                  <>
                    <Txt typography="t6" color={SdsColors.grey600} style={styles.centerText}>
                      {t('game.leaderboardError')}
                    </Txt>
                    <Button type="dark" style="weak" size="tiny" onPress={() => board.refetch()}>
                      {t('common.retry')}
                    </Button>
                  </>
                ) : (
                  <Txt typography="t6" color={SdsColors.grey600} style={styles.centerText}>
                    {t('game.leaderboardEmpty')}
                  </Txt>
                )}
              </View>
            }
          />
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { position: 'absolute', left: MARGIN, right: MARGIN },
  // Sized to the board, never past the slot.
  card: { maxHeight: '100%', minHeight: MIN_CARD_HEIGHT },
  content: { flexShrink: 1, paddingTop: 16, paddingHorizontal: 8, paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, marginBottom: 8 },
  titles: { flex: 1, gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The icon button's own box, so the X does not move while it spins.
  spinner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { paddingBottom: 4 },
  gap: { textAlign: 'center', paddingVertical: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  centerText: { textAlign: 'center' },
});
