import { Pressable, StyleSheet, View } from 'react-native';
import type { Router } from 'expo-router';
import { CaretRightIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import type { NativeGameId } from '../ids';

export function openLeaderboard(router: Router, gameId: NativeGameId): void {
  router.push({ pathname: '/games/[id]/leaderboard', params: { id: gameId } } as never);
}

/** A board's title row with "view all" — the same row the home screen's other sections use. */
export function BoardHeader({
  title,
  typography,
  onViewAll,
}: {
  title: string;
  typography: 't4' | 't5';
  onViewAll(): void;
}) {
  const { t } = useT();
  return (
    <View style={styles.row}>
      <Txt typography={typography} fontWeight="bold" color={SdsColors.grey900} numberOfLines={1} style={styles.title}>
        {title}
      </Txt>
      <Pressable
        onPress={onViewAll}
        style={({ pressed }) => [styles.viewAll, { opacity: pressed ? 0.6 : 1 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${t('common.viewAll')}`}
      >
        <Txt typography="t7" color={SdsColors.grey500}>
          {t('common.viewAll')}
        </Txt>
        <CaretRightIcon size={12} color={SdsColors.grey400} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { flex: 1, marginRight: 12 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
});
