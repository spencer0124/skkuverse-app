/**
 * The event list, living in the campus sheet while a chip has narrowed the map.
 *
 * Rows are the places of the layers the map is drawing — `selectVisibleOverlays`
 * decides that, on the same `isLayerVisible` the render loop uses, so the list
 * and the pins cannot disagree about a layer. **A place the pin ladder
 * suppressed still gets a row**: losing a shared coordinate to whoever is open
 * at this hour says nothing about whether the place exists. That is why this is
 * a panel inside the persistent sheet rather than a modal of its own — it
 * describes the map the user is looking at, and it goes away with the narrowing
 * that produced it.
 *
 * No count and no sort control: the rows arrive in the author's `order`
 * (`sortPlaces`) and the list starts straight away. No empty state either —
 * `CampusScreen` mounts this only with a row to show, and keeps the feed
 * otherwise.
 *
 * The sheet's whole body, not a sibling of the feed: a gorhom scrollable cannot
 * nest inside another, so `CampusScreen` mounts this INSTEAD of the feed's
 * `Sheet.ScrollView`. Both register with the sheet's draggable context on
 * mount, so the swap keeps the content pan gesture and a drag on the header
 * still moves the sheet.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SdsColors, type MapOverlay } from '@skkuverse/shared';
import { Sheet } from '@skkuverse/sds';
import { logCampusContentSelect } from '@/services/analytics';
import { PlaceCard } from './PlaceCard';

interface EventListPanelProps {
  /** Already narrowed to the visible layers and in the author's order. */
  places: readonly MapOverlay[];
  /** From `useWindowClock`, so every row's pill re-derives at a boundary together. */
  now: number;
  onSelectPlace: (place: MapOverlay) => void;
  /**
   * Room under the last row. `CampusScreen` measures it against the tab bar,
   * which on iOS 26 floats over the bottom of this list at the top detent.
   */
  bottomPadding: number;
}

export function EventListPanel({ places, now, onSelectPlace, bottomPadding }: EventListPanelProps) {
  const renderItem = useCallback(
    ({ item }: { item: MapOverlay }) => (
      <Pressable
        style={styles.row}
        accessibilityRole="button"
        onPress={() => {
          logCampusContentSelect({ content_type: 'eventmap_list_row', item_id: item.id });
          onSelectPlace(item);
        }}
      >
        <PlaceCard place={item} now={now} variant="compact" />
      </Pressable>
    ),
    [now, onSelectPlace],
  );

  return (
    <Sheet.FlatList
      data={places as MapOverlay[]}
      keyExtractor={(item: MapOverlay) => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
      ItemSeparatorComponent={Separator}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/**
 * Measured from the CARD's edge, not the screen's: the sheet body carries the
 * animated inset, so this gutter rides in with it and stays right at every
 * detent. The same number as the feed's `sheetFeed` in `CampusScreen`, for the
 * same reason — and the bottom padding clears the floating tab bar at the top
 * detent, also as the feed does.
 */
const GUTTER = 16;

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: { paddingHorizontal: GUTTER },
  row: { paddingVertical: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: SdsColors.grey200 },
});
