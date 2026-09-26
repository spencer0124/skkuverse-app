import { StyleSheet, View } from 'react-native';
import { Txt } from '@skkuverse/sds';

/** The card over a paused run: what happened, and how to carry on. */
export function PauseCard({ title, sub, ink, softInk }: { title: string; sub: string; ink: string; softInk: string }) {
  return (
    <View style={styles.card}>
      <Txt typography="t4" fontWeight="bold" color={ink}>
        {title}
      </Txt>
      <Txt typography="t7" color={softInk} style={styles.sub}>
        {sub}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  sub: { marginTop: 4 },
});
