/**
 * Offers the campus the camera is actually looking at.
 *
 * Shares the row with the locate button and takes the width the button leaves,
 * exactly as the campus toggle does beside the filter button at the top of the
 * map. `MAP_CONTROL_HEIGHT` is what makes the two read as one control set rather
 * than a card that happens to sit near a button — the same reason that constant
 * exists at all.
 *
 * ## Two regions, not two buttons
 *
 * The message itself is the accept target and the ✕ is the only other thing
 * that can be pressed. An earlier version put the word "전환" next to the ✕,
 * which read badly for a reason worth recording: the message already ends in
 * "전환할까요?", so the button repeated the verb the question had just used and
 * neither affordance looked primary. A question, answered by pressing it.
 *
 * The caret is what says so. Without it the question is just text and nothing
 * marks it as the thing to press — the ✕ ends up looking like the only control
 * in the card. The caret costs one glyph and makes the left side read as a
 * destination.
 *
 * ## No entering animation
 *
 * `GlassView` renders nothing when it is a child of a Reanimated `Animated.View`
 * carrying an `entering` layout animation — the card came up completely
 * transparent, map markers showing through the text. Every glass surface that
 * works in this app (`GlassChip`, `GlassIconButton`, `MapCompass`) is mounted
 * plainly, so this one is too. Fade it in from the parent's own animated style
 * if that is ever wanted, not with a layout animation around it.
 */

import { StyleSheet, Text, Pressable, View } from 'react-native';
import { CaretRightIcon, XIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { GlassSurface } from '@/components/glass';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';

interface CampusSuggestionCardProps {
  /** Already interpolated with the campus name by the caller. */
  message: string;
  dismissLabel: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function CampusSuggestionCard({
  message,
  dismissLabel,
  onAccept,
  onDismiss,
}: CampusSuggestionCardProps) {
  return (
    <GlassSurface interactive style={styles.surface}>
      <View style={styles.row}>
        <Pressable
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={message}
          style={styles.body}
        >
          <Text style={styles.message} numberOfLines={1}>
            {message}
          </Text>
          <CaretRightIcon size={14} color={SdsColors.grey500} weight="bold" />
        </Pressable>
        {/* Hairline rather than a gap: it is what tells the eye the ✕ is a
            separate answer to the question and not punctuation at the end of
            it. */}
        <View style={styles.divider} />
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          style={styles.close}
        >
          <XIcon size={14} color={SdsColors.grey500} weight="bold" />
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const DIVIDER_INSET = 10;

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: '100%',
    paddingLeft: 16,
    paddingRight: 12,
  },
  message: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: SdsColors.grey800,
  },
  divider: {
    // A full point, not `hairlineWidth`: over a translucent material a hairline
    // is averaged away with the map behind it and stops separating anything.
    width: 1,
    height: MAP_CONTROL_HEIGHT - DIVIDER_INSET * 2,
    backgroundColor: SdsColors.grey300,
  },
  close: {
    width: MAP_CONTROL_HEIGHT,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
