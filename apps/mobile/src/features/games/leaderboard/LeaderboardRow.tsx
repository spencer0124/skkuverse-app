import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import { maskedEmail } from '@/features/profile/domain';
import type { BoardLine } from './domain';

const HIGHLIGHT = '#DDF2E7';

/**
 * One line of a board: rank, nickname with the masked email, campus, score.
 * The player's own line glows and settles; a ghost (a score not on the board
 * yet) is drawn dashed with its projected rank.
 */
/** The player's own line flashes when it appears and whenever its rank changes, then settles. */
function Glow({ rank }: { rank: number }) {
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = 1;
    glow.value = withTiming(0.35, { duration: 800, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System });
  }, [rank, glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, style]} />;
}

export function LeaderboardRow({ line, format }: { line: Exclude<BoardLine, { kind: 'gap' }>; format(score: number): string }) {
  const { t } = useT();
  if (line.kind === 'empty') {
    return (
      <View style={styles.row}>
        <Txt typography="t5" fontWeight="bold" color={SdsColors.grey300} style={styles.rank}>
          {line.rank}
        </Txt>
        <View style={[styles.who, styles.blankWho]}>
          <View style={styles.blank} />
        </View>
        <Txt typography="t5" fontWeight="bold" color={SdsColors.grey300}>
          -
        </Txt>
      </View>
    );
  }
  const mine = line.kind === 'ghost' || line.mine;
  const topThree = line.rank <= 3;

  return (
    <View style={[styles.row, line.kind === 'ghost' && styles.ghost]}>
      {mine && <Glow rank={line.rank} />}
      <Txt typography="t5" fontWeight="bold" color={topThree ? SdsColors.brand : SdsColors.grey600} style={styles.rank}>
        {line.rank}
      </Txt>
      <View style={styles.who}>
        {line.kind === 'ghost' ? (
          <View style={styles.nameLine}>
            <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey900}>
              {t('game.me')}
            </Txt>
            <Txt typography="t7" color={SdsColors.grey500} style={styles.after}>
              {t('game.projected')}
            </Txt>
          </View>
        ) : (
          <>
            <View style={styles.nameLine}>
              <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey900} numberOfLines={1} style={styles.name}>
                {line.entry.nickname}
              </Txt>
              {line.entry.emailPrefix !== '' && (
                <Txt typography="t7" color={SdsColors.grey500} style={styles.after}>
                  {maskedEmail(line.entry.emailPrefix)}
                </Txt>
              )}
              {line.mine && (
                <Txt typography="t7" fontWeight="bold" color={SdsColors.brand} style={styles.after}>
                  {t('game.me')}
                </Txt>
              )}
            </View>
            <Txt typography="t7" color={SdsColors.grey600}>
              {t(line.entry.campus === 'nsc' ? 'campus.nsc' : 'campus.hssc')}
            </Txt>
          </>
        )}
      </View>
      <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900}>
        {format(line.kind === 'ghost' ? line.score : line.entry.score)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ghost: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: SdsColors.brand },
  glow: { backgroundColor: HIGHLIGHT, borderRadius: 12 },
  rank: { width: 32, textAlign: 'center' },
  who: { flex: 1, marginHorizontal: 10 },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1 },
  after: { marginLeft: 6 },
  blankWho: { justifyContent: 'center' },
  blank: { width: 72, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.06)' },
});
