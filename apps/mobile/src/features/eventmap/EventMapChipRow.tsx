/**
 * Quick-toggle chips, floating over the map.
 *
 * Carries only the groups the server left unlabelled. That is the whole rule,
 * and it is the server's to change: a group with `label: null` has nothing to
 * head a section with, so it reads as a standalone toggle — ESKARA's `now` group
 * ("지금 운영중") is exactly that shape. Labelled groups are sections, and
 * sections belong in `FilterSheet`.
 *
 * The alternative — every group flattened into one scrolling strip — puts ten
 * chips over the map and then repeats all ten in the sheet, so every piece of
 * state has two controls. Here the map carries the one-tap case and the filter
 * button carries a count, which is a state signal rather than a duplicate.
 */

import { StyleSheet, View } from 'react-native';
import type { EventMapChipGroup } from '@skkuverse/shared';
import { useEventMapStore } from '@skkuverse/shared';
import { GlassChip } from '@/components/glass';
import { logCampusContentSelect } from '@/services/analytics';

interface EventMapChipRowProps {
  chipGroups: readonly EventMapChipGroup[];
}

export function EventMapChipRow({ chipGroups }: EventMapChipRowProps) {
  const selectedChips = useEventMapStore((s) => s.selectedChips);
  const toggleChip = useEventMapStore((s) => s.toggleChip);

  const quickGroups = chipGroups.filter((g) => g.label === null);
  if (quickGroups.length === 0) return null;

  return (
    // A wrapping row rather than a horizontal ScrollView, and `box-none` rather
    // than the default: a full-width scroller would swallow every touch in its
    // band, so one 지금 운영중 chip would cost a whole strip of map panning. Sized
    // to its content, the chips catch their own taps and the gaps beside them
    // still pan the map. Unlabelled groups are the one-tap case by definition, so
    // there are few of them; many would wrap to a second line, which is still
    // better than an invisible dead band.
    <View style={styles.row} pointerEvents="box-none">
      {quickGroups.flatMap((group) =>
        group.chips.map((chip) => {
          const selected = (selectedChips[group.id] ?? []).includes(chip.id);
          return (
            <GlassChip
              key={chip.id}
              label={chip.label}
              selected={selected}
              onPress={() => {
                logCampusContentSelect({ content_type: 'eventmap_chip', item_id: chip.id });
                toggleChip(group.id, chip.id, group.selection);
              }}
            />
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    // Keeps the row as wide as its chips, so it claims no touch area it does not
    // draw into.
    alignSelf: 'flex-start',
    gap: 8,
  },
});
