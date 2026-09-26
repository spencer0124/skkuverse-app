import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import { ResultCard } from './ResultCard';

interface Props {
  score: ReactNode;
  board: ReactNode;
  /** The revive offer, when this crash had one — it closes the board's card. */
  offer?: ReactNode;
  /** Move on: to the game's title, or to the one question that puts this run on the board. */
  onNext(): void;
  /** Room left at the top for the screen's own floating buttons. */
  topInset: number;
  /** Laid over the game behind the cards (registry `scrim`). */
  scrim: string;
}

/**
 * What a game shows when a run ends: two floating cards over the dimmed game —
 * the score, then the board with the chance to continue under it — and one
 * way on, "next", pinned to the bottom. Game-agnostic: the contents are handed
 * in.
 */
export function ResultPanel({ score, board, offer, onNext, topInset, scrim }: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}
        style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={[styles.cards, { paddingTop: topInset, paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ResultCard order={0}>{score}</ResultCard>
        <ResultCard order={1}>
          {board}
          {offer && <View style={styles.offer}>{offer}</View>}
        </ResultCard>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Button type="dark" size="big" display="block" onPress={onNext}>
          {t('game.next')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { paddingHorizontal: 16, gap: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  offer: { marginTop: 16 },
});
