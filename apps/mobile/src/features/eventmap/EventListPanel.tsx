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
 * No count and no sort control: the rows arrive already filtered and in the
 * order the chip's `list` asks for (`sortForList`), or the author's `order`
 * for a chip with no list.
 *
 * Filters, when the chip has a `list`: ONE row of dropdown chips, one per
 * facet, each reading what is in force — `일자: 10/1(목) ▾`, `운영: 전체 ▾`. A tap
 * opens the option sheet (`ListFacetSheet`, owned by `CampusScreen`). One row
 * rather than a control per facet stacked above the list, so a list with two
 * filters is not a different shape from a list with one. This file decides
 * nothing about membership — it reports taps and draws what it is handed —
 * and the empty state exists for a selection with no rows, because
 * `CampusScreen` keeps the list mounted while the chip's layers hold any place.
 *
 * The sheet's whole body, not a sibling of the feed: a gorhom scrollable cannot
 * nest inside another, so `CampusScreen` mounts this INSTEAD of the feed's
 * `Sheet.ScrollView`. Both register with the sheet's draggable context on
 * mount, so the swap keeps the content pan gesture and a drag on the header
 * still moves the sheet.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SdsColors,
  isFacetNarrowed,
  isWholeFacet,
  useT,
  type FacetSelection,
  type MapChipList,
  type MapOverlay,
} from '@skkuverse/shared';
import { Sheet, Txt } from '@skkuverse/sds';
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
  /** The narrowed chip's list, or `null` for an unfiltered one (no controls). */
  list: MapChipList | null;
  selection: FacetSelection;
  /** A filter chip was tapped; `CampusScreen` opens that facet's option sheet. */
  onOpenFacet: (facetId: string) => void;
}

export function EventListPanel({
  places,
  now,
  onSelectPlace,
  bottomPadding,
  list,
  selection,
  onOpenFacet,
}: EventListPanelProps) {
  const { t } = useT();
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

  const header =
    list && list.facets.length > 0 ? (
      <View style={styles.filters}>
        {list.facets.map((facet) => {
          const held = selection[facet.id] ?? [];
          // Every chip names its facet — `일자: 10/1(목)`, `운영: 전체` — so
          // the row reads the same whatever kind of filter it holds. A facet
          // with every option checked reads 전체.
          const value = isWholeFacet(facet, held) && facet.options.length > 1
            ? t('common.total')
            : facet.options
                .filter((o) => held.includes(o.id))
                .map((o) => o.label)
                .join(', ');
          // Green only for a choice the user made — never for 전체 or a default.
          const engaged = isFacetNarrowed(facet, held);
          return (
            <Pressable
              key={facet.id}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.filterChip,
                engaged && styles.filterChipEngaged,
                pressed && styles.filterChipPressed,
              ]}
              onPress={() => {
                logCampusContentSelect({ content_type: 'eventmap_list_facet', item_id: facet.id });
                onOpenFacet(facet.id);
              }}
            >
              <Txt typography="t6" fontWeight="semiBold" color={engaged ? SdsColors.brand : SdsColors.grey800}>
                {`${facet.label}: ${value}`}
              </Txt>
              <Ionicons name="chevron-down" size={14} color={engaged ? SdsColors.brand : SdsColors.grey500} />
            </Pressable>
          );
        })}
      </View>
    ) : null;

  return (
    <Sheet.FlatList
      data={places as MapOverlay[]}
      keyExtractor={(item: MapOverlay) => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Txt typography="t6" color={SdsColors.grey500} style={styles.empty}>
          {t('eventmap.list.empty')}
        </Txt>
      }
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4, paddingBottom: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SdsColors.grey100,
  },
  filterChipEngaged: { backgroundColor: SdsColors.brandLight },
  filterChipPressed: { opacity: 0.6 },
  empty: { textAlign: 'center', paddingVertical: 32 },
});
