import { StyleSheet, Text, View } from 'react-native';
import { SdsColors } from '@skkuverse/shared';

/**
 * Emoji-as-logo tile for a mini-app that has no icon asset (`logo.kind ===
 * 'emoji'`). A rounded square the same footprint as the remote-image logo it
 * substitutes for, so callers can swap between the two without touching
 * layout.
 *
 * Sizing is proportional to `size` rather than fixed, since this renders at
 * the 16pt place-sheet pill, the 18pt shell pill and the 40pt info-sheet icon.
 * The 0.72 / 0.95 ratios are a starting point that has not yet been checked on
 * a device; if the glyph sits off-centre in the tile, these are the two numbers
 * to adjust.
 */
export function MiniAppEmojiLogo({
  emoji,
  size,
}: {
  emoji: string;
  size: number;
}) {
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size * 0.22 },
      ]}
      accessible={false}
    >
      <Text
        style={[
          styles.emoji,
          {
            fontSize: Math.round(size * 0.72),
            lineHeight: Math.round(size * 0.95),
          },
        ]}
      >
        {emoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    fontFamily: 'TossFaceFontMac',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
