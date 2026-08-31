import { StyleSheet, View } from 'react-native';

import { FloatingEmoji, type EmojiSpec } from '@/components/FloatingEmoji';

/**
 * The drifting emoji cluster on the intro's sign-in page.
 *
 * Same motion as the home HeroBanner (shared `FloatingEmoji`), re-scattered for
 * a canvas roughly five times taller. The four emoji are the four things the
 * body copy names — 📢 AI공지 요약, ⏰ 공지 알림, 🚌 셔틀정보, 🗺️ 캠퍼스맵 — so
 * the picture and the list say the same thing.
 *
 * The field is square (`aspectRatio: 1`) rather than filling the page. Absolute
 * children position off the parent, and letting it stretch to the full figure
 * height would pull the cluster apart into four unrelated corners instead of
 * one loose group.
 */

// Sizes graduated 72 → 44 so 📢 reads first and the eye drifts outward, and
// rotations spread ±22° so the group looks tossed rather than laid out on a
// grid. Percentages are the emoji's top-left corner, so the larger ones sit at
// lower percentages than their visual centre suggests.
const EMOJIS: readonly EmojiSpec[] = [
  { ch: '\u{1F4E2}', left: '26%', top: '36%', size: 80, rot: -12, delay: 0, float: 16 },
  { ch: '\u{1F68C}', left: '62%', top: '6%', size: 58, rot: 16, delay: 800, float: 13 },
  { ch: '\u{1F5FA}', left: '8%', top: '4%', size: 46, rot: -22, delay: 1400, float: 11 },
  { ch: '\u{23F0}', left: '64%', top: '64%', size: 52, rot: 10, delay: 2000, float: 14 },
];

export function IntroEmojiField() {
  return (
    <View style={styles.field}>
      {EMOJIS.map((spec) => (
        <FloatingEmoji key={spec.ch} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 360,
    alignSelf: 'center',
    position: 'relative',
  },
});
