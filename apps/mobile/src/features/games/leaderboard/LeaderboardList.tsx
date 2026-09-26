import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Txt } from '@skkuverse/sds';
import { SdsColors } from '@skkuverse/shared';
import type { BoardLine } from './domain';
import { LeaderboardRow } from './LeaderboardRow';

// A ratio, not a raw damping: Reanimated 4's spring defaults (mass 4, stiffness 900)
// would make a small damping value bounce rows past their slots.
const MOVE = LinearTransition.springify().dampingRatio(0.9).reduceMotion(ReduceMotion.System);
const ENTER = FadeIn.duration(250).reduceMotion(ReduceMotion.System);
const EXIT = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

/**
 * A short board (a top N and the player's line), animated: lines keep their
 * key, so when the player's line climbs, the lines it passes slide down and
 * it slides up. What is there on first render simply appears.
 *
 * Plain views rather than a FlatList — it is a handful of rows, and layout
 * transitions on plain views are the simple, reliable path.
 */
export function LeaderboardList({ lines, format }: { lines: readonly BoardLine[]; format(score: number): string }) {
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <View>
        {lines.map((line) => (
          <Animated.View key={line.key} layout={MOVE} entering={ENTER} exiting={EXIT}>
            {line.kind === 'gap' ? (
              <Txt typography="t6" color={SdsColors.grey400} style={styles.gap}>
                ⋯
              </Txt>
            ) : (
              <LeaderboardRow line={line} format={format} />
            )}
          </Animated.View>
        ))}
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  gap: { textAlign: 'center', paddingVertical: 2 },
});
