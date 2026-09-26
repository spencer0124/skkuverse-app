import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT, type TranslationKey } from '@skkuverse/shared';

interface Props {
  headline: string;
  score: number;
  best: number;
  /** The game's number, without a unit (registry `score.format`). */
  format(score: number): string;
  /** After the number, smaller ("점"); none for a time. */
  unit?: string;
  /** Rows under the best: the run's other figures (a typing game's speed). */
  details?: readonly { labelKey: TranslationKey; value: string }[];
  isNewBest: boolean;
}

const COUNT_MS = 900;
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

/**
 * The run's score, read top to bottom: what happened, the score itself — the
 * one big thing on the card, counted up, with NEW beside it when it is a
 * record — and the best as a label/value row under a hairline, followed by
 * whatever else the game reports. A time counts up like a stopwatch.
 */
export function ScoreHeader({ headline, score, best, format, unit, details, isNewBest }: Props) {
  const { t } = useT();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const x = Math.min(1, (Date.now() - start) / COUNT_MS);
      setShown(Math.round(score * easeOutCubic(x)));
      if (x < 1) raf = requestAnimationFrame(step);
      else if (isNewBest) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score, isNewBest]);

  return (
    <View>
      <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey600}>
        {headline}
      </Txt>
      <View style={styles.scoreLine}>
        <Txt typography="t1" fontWeight="bold" color={SdsColors.grey900} style={styles.score}>
          {format(shown)}
        </Txt>
        {unit && (
          <Txt typography="t4" fontWeight="bold" color={SdsColors.grey700} style={styles.unit}>
            {unit}
          </Txt>
        )}
        {isNewBest && (
          <Animated.View
            entering={ZoomIn.springify().dampingRatio(0.55).delay(COUNT_MS).reduceMotion(ReduceMotion.System)}
            style={styles.badge}
          >
            <Txt typography="t7" fontWeight="bold" color="#FFFFFF">
              {t('game.newBest')}
            </Txt>
          </Animated.View>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Txt typography="t6" color={SdsColors.grey600}>
          {t('game.bestLabel')}
        </Txt>
        <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
          {`${format(best)}${unit ?? ''}`}
        </Txt>
      </View>
      {details?.map((d) => (
        <View key={d.labelKey} style={[styles.row, styles.detail]}>
          <Txt typography="t6" color={SdsColors.grey600}>
            {t(d.labelKey)}
          </Txt>
          <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
            {d.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreLine: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  score: { fontSize: 44, lineHeight: 52, fontVariant: ['tabular-nums'] },
  unit: { marginLeft: 2, marginBottom: 7 },
  badge: {
    alignSelf: 'center',
    marginLeft: 10,
    marginTop: 4,
    backgroundColor: SdsColors.brand,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { marginTop: 8 },
});
