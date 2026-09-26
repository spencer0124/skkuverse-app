import { StyleSheet, View } from 'react-native';
import { Txt } from '@skkuverse/sds';

interface Props {
  /** A line above the title; omitted when the game has none. */
  eyebrow?: string;
  title: string;
  sub: string;
  /** "Best 1,234", shown under the rest; omitted before a first run. */
  best?: string;
  /** Title and best. */
  ink: string;
  /** Eyebrow and sub. */
  softInk: string;
  /** The eyebrow alone, when a game colours it (a line colour). */
  eyebrowInk?: string;
}

/**
 * A game's title before the first run: eyebrow, title, one line on how to
 * play, and the device best. Where it sits is the game's overlay's choice —
 * it has to land on the part of the page left clear for it.
 */
export function StageTitle({ eyebrow, title, sub, best, ink, softInk, eyebrowInk }: Props) {
  return (
    <View style={styles.block}>
      {eyebrow && (
        <Txt typography="t7" fontWeight="semibold" color={eyebrowInk ?? softInk}>
          {eyebrow}
        </Txt>
      )}
      <Txt typography="t1" fontWeight="bold" color={ink} style={styles.title}>
        {title}
      </Txt>
      <Txt typography="t6" color={softInk} style={styles.sub}>
        {sub}
      </Txt>
      {best && (
        <Txt typography="t7" fontWeight="semibold" color={ink} style={styles.best}>
          {best}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center' },
  title: { marginVertical: 6, textAlign: 'center' },
  sub: { textAlign: 'center' },
  best: { marginTop: 12 },
});
