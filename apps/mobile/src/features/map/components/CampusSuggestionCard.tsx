/**
 * A single-line offer floating above the sheet.
 *
 * Shares the row with the locate button and takes the width the button leaves,
 * exactly as the campus toggle does beside the filter button at the top of the
 * map. `MAP_CONTROL_HEIGHT` is what makes the two read as one control set rather
 * than a card that happens to sit near a button — the same reason that constant
 * exists at all.
 *
 * ## The message states, the button acts
 *
 * Two earlier versions put the verb in the message ("전환할까요?") and marked the
 * whole card tappable, first with the word "전환" beside the ✕ and then with a
 * caret. Both read badly, and the caret is the more instructive failure: `>` is
 * a NAVIGATION idiom — it means "this row opens something" — so borrowing it for
 * a command leaves the reader unsure whether pressing it goes somewhere or does
 * something. A filled button is unambiguous, and once the button carries the
 * verb the message is free to be a plain statement of fact.
 *
 * ## `onDismiss` is optional
 *
 * Omitting it drops the ✕, for the one offer that must not be waved away: with
 * location permission refused the map cannot show a position at all, so hiding
 * the way to fix that would leave the locate button permanently inert with no
 * explanation. Every other offer is refusable, because a suggestion that cannot
 * be refused is a nag.
 *
 * ## No entering animation
 *
 * `GlassView` renders nothing when it is a child of a Reanimated `Animated.View`
 * carrying an `entering` layout animation — the card came up completely
 * transparent, map markers showing through the text. Every glass surface that
 * works in this app (`GlassChip`, `GlassIconButton`, `MapCompass`) is mounted
 * plainly, so this one is too.
 */

import { StyleSheet, Text, Pressable, View } from 'react-native';
import { XIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { GlassSurface } from '@/components/glass';
import { MAP_CONTROL_HEIGHT } from './controlMetrics';

interface CampusSuggestionCardProps {
  /** A statement, already interpolated with the campus name by the caller. */
  message: string;
  /** The verb. Short — it shares a 40pt row with the locate button. */
  actionLabel: string;
  onAccept: () => void;
  /** Omit to render no ✕, making the offer un-dismissable. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function CampusSuggestionCard({
  message,
  actionLabel,
  onAccept,
  onDismiss,
  dismissLabel,
}: CampusSuggestionCardProps) {
  return (
    <GlassSurface interactive style={styles.surface}>
      <View style={styles.row}>
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
        <Pressable
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={`${message}. ${actionLabel}`}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel} numberOfLines={1}>
            {actionLabel}
          </Text>
        </Pressable>
        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            style={styles.close}
          >
            <XIcon size={14} color={SdsColors.grey500} weight="bold" />
          </Pressable>
        )}
      </View>
    </GlassSurface>
  );
}

const ACTION_HEIGHT = 28;

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
    gap: 8,
    paddingLeft: 16,
    // Smaller than the left inset: the ✕ and the button carry their own tap
    // padding, so matching 16 here would read as a gap twice the size.
    paddingRight: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: SdsColors.grey800,
  },
  action: {
    height: ACTION_HEIGHT,
    borderRadius: ACTION_HEIGHT / 2,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.brand,
  },
  actionPressed: {
    opacity: 0.75,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  close: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
