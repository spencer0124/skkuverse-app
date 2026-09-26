import { StyleSheet, Text, View } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import type { NativeGameId } from '../ids';
import { NATIVE_GAMES } from '../registry';

/** Which game a board is: its Tossface emoji and name. */
export function GameChip({ gameId }: { gameId: NativeGameId }) {
  const { t } = useT();
  const game = NATIVE_GAMES[gameId];
  return (
    <View style={styles.chip}>
      <Text style={styles.emoji}>{game.homeEmoji}</Text>
      <Txt typography="t6" fontWeight="bold" color={SdsColors.grey800}>
        {t(game.titleKey)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji: { fontFamily: 'TossFaceFontMac', fontSize: 18 },
});
