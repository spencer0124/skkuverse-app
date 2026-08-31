import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  /** Page width — the pager sizes every page to the window so paging snaps. */
  width: number;
  title: string;
  body: string;
  /** Mock card demonstrating the feature. Vertically centred in the gap. */
  figure: ReactNode;
}

/**
 * One page of the first-launch tour: headline, supporting line, and a mock card.
 *
 * Padding lives here rather than on the pager because the ScrollView has to run
 * edge-to-edge for `pagingEnabled` to snap on the window width.
 *
 * Type matches the notices landing (32/40 headline, 18/26 subtitle) so the
 * intro's third page and the notices gate read as one screen shown twice.
 */
export function IntroPage({ width, title, body, figure }: Props) {
  return (
    <View style={[styles.page, { width }]}>
      <View>
        <Text style={styles.headline}>{title}</Text>
        <Text style={styles.subtitle}>{body}</Text>
      </View>
      <View style={styles.figure}>{figure}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    // No `flex: 1` — inside a horizontal ScrollView that would set flexBasis 0
    // on the main axis and fight the explicit `width`, collapsing every page to
    // nothing. The content container stretches children on the cross axis, so
    // full height comes for free.
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.7,
    color: '#000',
  },
  subtitle: {
    fontSize: 18,
    color: '#6b6b6b',
    marginTop: 16,
    lineHeight: 26,
  },
  figure: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
});
