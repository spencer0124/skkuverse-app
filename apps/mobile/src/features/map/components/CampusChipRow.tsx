/**
 * Campus quick-category chips, floating under the search bar.
 *
 * MOCK: the chip list is hardcoded here on purpose. There is no server contract
 * for campus POI categories yet — `/map/config` ships only `building_numbers`
 * and `building_labels` — so this is a UI shell to iterate on, not a feature.
 * When the endpoint lands, `CAMPUS_CHIPS` is what gets deleted; nothing else in
 * this file assumes the data is local. Labels are hardcoded Korean rather than
 * `useT()` keys for the same reason: an i18n key per mock chip is churn that
 * gets thrown away with the mock.
 *
 * A horizontal ScrollView, unlike `EventMapChipRow`'s wrapping row, which
 * documents its refusal of one. Both are right for their case. That row carries
 * a couple of one-tap event toggles and can afford to stay content-sized, so it
 * claims no touch area it does not draw into. This row is the Naver-Maps
 * category strip — the overflow off the right edge IS the affordance telling
 * you there are more categories — and that needs a real scroller. The cost is a
 * band the map cannot be panned through; it is bounded to the chip height, sits
 * directly under the search bar (already a dead band), and is the same trade
 * Naver Maps itself makes.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { GlassChip } from '@/components/glass';

interface CampusChip {
  id: string;
  /** Tossface emoji — coloured mark, matching the reference's icon chips. */
  emoji: string;
  label: string;
}

const CAMPUS_CHIPS: readonly CampusChip[] = [
  { id: 'cafeteria', emoji: '\u{1F35A}', label: '학식' },
  { id: 'cafe', emoji: '\u{2615}', label: '카페' },
  { id: 'convenience', emoji: '\u{1F3EA}', label: '편의점' },
  { id: 'reading_room', emoji: '\u{1F4D6}', label: '열람실' },
  { id: 'printer', emoji: '\u{1F5A8}', label: '프린터' },
  { id: 'restroom', emoji: '\u{1F6BB}', label: '화장실' },
  { id: 'atm', emoji: '\u{1F3E7}', label: 'ATM' },
  { id: 'shuttle', emoji: '\u{1F68C}', label: '셔틀' },
];

export function CampusChipRow() {
  // Single-select, and local. Single because these read as "what am I looking
  // for right now" rather than as accumulating filters — the reference outlines
  // exactly one. Local because a mock must not write to `useMapLayerStore`,
  // which is persisted: a category id from a throwaway UI would outlive it.
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      {CAMPUS_CHIPS.map((chip) => (
        <GlassChip
          key={chip.id}
          label={chip.label}
          selected={chip.id === selectedId}
          icon={<Text style={styles.emoji}>{chip.emoji}</Text>}
          // Tapping the selected chip clears it, so there is always a way back
          // to the unfiltered map without hunting for a reset control.
          onPress={() => setSelectedId((prev) => (prev === chip.id ? null : chip.id))}
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
