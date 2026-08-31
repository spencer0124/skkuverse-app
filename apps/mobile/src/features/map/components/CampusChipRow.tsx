/**
 * The map's chip row — server-driven quick actions, floating under the campus
 * controls.
 *
 * A layer answers *what is drawn*. A chip answers *where should I be looking,
 * and what should be on while I look there*. Both come from `/map/config`, and
 * this component renders a pill and reports the tap; it does not interpret the
 * action. What a chip does lives at the call site, and what a `focus` chip does
 * to layer visibility lives in `@skkuverse/shared`'s `map/chips.ts`.
 *
 * This replaced a hardcoded 학식/카페/편의점 mock whose own header said the list
 * "is what gets deleted" when an endpoint landed. It has.
 *
 * **No `selected` prop is passed, on purpose.** A chip's tap sets a whole
 * group's visibility, so a lit pill would be claiming to describe state that
 * the filter sheet can change out from under it. Instead this row is REPLACED
 * by `ActiveChipStrip` once the map is narrowed to a chip's view, and that
 * strip can simply stop naming one. The two share `GlassChip`'s metrics so the
 * swap does not change the band's height.
 *
 * A horizontal ScrollView, knowing what it costs. A scroller over the map
 * stretches to its parent's width whether or not it draws anything there, so
 * it claims a full-width band the map cannot be panned through — which is why
 * the event map's old one-tap toggle row was a content-sized wrapping row
 * instead. This row is the Naver-Maps category strip — the overflow off the
 * right edge IS the affordance telling you there are more — and that needs a
 * real scroller. The band is bounded to the chip height, sits directly under
 * the control row, and is the same trade Naver Maps itself makes.
 */

import { ScrollView, StyleSheet, Text } from 'react-native';
import type { MapChip } from '@skkuverse/shared';
import { GlassChip } from '@skkuverse/sds';

interface CampusChipRowProps {
  chips: MapChip[];
  onPress: (chip: MapChip) => void;
}

export function CampusChipRow({ chips, onPress }: CampusChipRowProps) {
  // Nothing rather than an empty scroller. The control column spaces its
  // children with a gap, so a zero-height row would still leave a hole — and an
  // empty list is the ordinary state off a festival, and the whole state when
  // the config request failed and `DEFAULT_MAP_CONFIG` took over.
  if (!chips.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      // The chips must clear the search bar's shadow, and a ScrollView clips to
      // its own bounds on Android without this.
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => (
        <GlassChip
          key={chip.id}
          label={chip.label}
          // `icon` is nullable on the wire before anything sends null: the
          // server declared a text-only chip reachable so one can arrive
          // without a coordinated release, and this is the branch that costs.
          icon={
            chip.icon ? <Text style={styles.emoji}>{chip.icon.emoji}</Text> : undefined
          }
          onPress={() => onPress(chip)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // Cancels the parent control column's 16pt inset so the strip runs edge to
    // edge, then `content` puts the padding back inside the scrollable area.
    // Without this the last chip stops 16pt short and reads as the end of the
    // list rather than as clipped.
    marginHorizontal: -16,
    // Sized to content. `flexGrow: 0` is load-bearing: a horizontal ScrollView
    // in a column parent otherwise stretches to fill the remaining height and
    // swallows the whole map.
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 15,
    // Tossface glyphs sit high in their em box; without this they ride above
    // the label's baseline.
    lineHeight: 18,
  },
});
