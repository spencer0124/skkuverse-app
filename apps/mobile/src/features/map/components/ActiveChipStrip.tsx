/**
 * Names the chip view the map is narrowed to, in place of the chip row.
 *
 * It **replaces** `CampusChipRow` rather than sitting above it, and takes that
 * row's full width so the control column's height does not change when a chip
 * is tapped. The metrics are `GlassChip`'s verbatim for the same reason: a
 * strip a couple of points taller than the pills it stands in for would make
 * every tap nudge the map's lower controls.
 *
 * The cost is that reaching a different chip is two taps — clear, then pick —
 * rather than one. That is the trade of a row that shows one thing at a time.
 *
 * Which chip is active is DERIVED from layer visibility by `findNarrowedChip`
 * rather than stored, so opening the filter sheet and turning a layer on makes
 * this disappear on its own, because no chip describes the map any more.
 *
 * It appears only when the map has actually been NARROWED to a chip's view. A
 * group sitting at the visibility the server declared has narrowed nothing, so
 * naming it would hide the chip row for the whole festival — the same rule the
 * filter button's badge already uses, where a layer the server ships hidden
 * does not count as the user having filtered. That is also why the clear
 * control is unconditional: if the strip is up, there is something to clear.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { XIcon } from 'phosphor-react-native';
import { SdsColors, type MapChip } from '@skkuverse/shared';
import { GlassSurface } from '@/components/glass';

interface ActiveChipStripProps {
  chip: MapChip;
  onClear: () => void;
  clearLabel: string;
}

/** Drawn size plus hit slop each side reaches Apple's 44pt minimum. */
const CLEAR_SIZE = 18;
const CLEAR_HIT_SLOP = 13;

export function ActiveChipStrip({ chip, onClear, clearLabel }: ActiveChipStripProps) {
  return (
    // Deliberately NOT `interactive`, unlike GlassChip and GlassIconButton. That
    // prop gives the whole glass surface press feedback, and this surface is a
    // label with one small button inside it rather than a button — lighting the
    // entire strip under a finger would promise a tap target that is not there.
    <GlassSurface style={styles.strip}>
      {chip.icon ? <Text style={styles.emoji}>{chip.icon.emoji}</Text> : null}
      {/* `flex: 1` rather than a `space-between` on the row: it puts the clear
          control hard against the right edge AND gives the label the whole
          middle to be truncated within, which a three-child space-between would
          not — the label would size to its content and leave a gap that grows
          with the screen. */}
      <Text style={styles.label} numberOfLines={1}>
        {chip.label}
      </Text>
      <Pressable
        onPress={onClear}
        // 18pt drawn plus 13 each side is 44, Apple's minimum. The control is
        // small because it is a dismissal beside a label, not a primary action;
        // the target it claims is not.
        hitSlop={CLEAR_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={clearLabel}
        style={styles.clear}
      >
        <XIcon size={14} color={SdsColors.grey600} weight="bold" />
      </Pressable>
    </GlassSurface>
  );
}

/** GlassChip's label metrics, with an explicit line height. */
const LABEL_SIZE = 14;
const LABEL_LINE_HEIGHT = 18;

const styles = StyleSheet.create({
  strip: {
    // No `alignSelf`, so it stretches to the control column's full width — the
    // same span the chip row it replaces occupies.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // GlassChip's pill metrics verbatim, so the strip is exactly as tall as the
    // row it stands in for. `overflow` is load-bearing on the glass path: the
    // effect bleeds past the rounded corners without it.
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 15,
    // Tossface glyphs sit high in their em box; without this they ride above
    // the label's baseline.
    lineHeight: LABEL_LINE_HEIGHT,
  },
  label: {
    // Claims the middle, which is what pins the clear control right.
    flex: 1,
    fontSize: LABEL_SIZE,
    lineHeight: LABEL_LINE_HEIGHT,
    // A weight heavier than a chip's: this names the view rather than offering
    // it, so it should read as a title in the row's place and not as a button
    // that stayed behind.
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  clear: {
    width: CLEAR_SIZE,
    height: CLEAR_SIZE,
    borderRadius: CLEAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.grey100,
  },
});
