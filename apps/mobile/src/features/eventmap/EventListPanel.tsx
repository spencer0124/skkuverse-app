/**
 * The event list, living in the campus sheet while a chip has narrowed the map.
 *
 * Rows are the places of the layers the map is drawing — `selectVisibleMarkers`
 * decides that, on the same `isLayerVisible` the render loop uses, so the list
 * and the pins cannot disagree about a layer. **A place the pin ladder
 * suppressed still gets a row**: losing a shared coordinate to whoever is open
 * at this hour says nothing about whether the place exists. That is why this is
 * a panel inside the persistent sheet rather than a modal of its own — it
 * describes the map the user is looking at, and it goes away with the narrowing
 * that produced it.
 *
 * This is the only surface on which a sort is observable. Pins are positional,
 * and a tap now resolves to exactly one place, so without a list the sort would
 * be a control with no visible effect — which is also why it lives here rather
 * than in `FilterSheet`.
 *
 * The orders are the client's own. The snapshot used to declare a `sorts` array
 * with server-authored labels; there is no snapshot, so `PLACE_SORTS` is the
 * offer and the labels are translations.
 *
 * The sheet's whole body, not a sibling of the feed: a gorhom scrollable cannot
 * nest inside another, so `CampusScreen` mounts this INSTEAD of the feed's
 * `BottomSheetScrollView`. Both register with the sheet's draggable context on
 * mount, so the swap keeps the content pan gesture and a drag on the header
 * still moves the sheet.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
  PLACE_SORTS,
  SdsColors,
  useEventMapStore,
  useT,
  type PlaceSortKey,
  type RawMarkerData,
  type TranslationKey,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { FilterPill } from '@/features/map/components/FilterPill';
import { logCampusContentSelect } from '@/services/analytics';
import { PlaceCard } from './PlaceCard';

const SORT_LABEL: Record<PlaceSortKey, TranslationKey> = {
  order: 'eventmap.sort.order',
  opening: 'eventmap.sort.opening',
  title: 'eventmap.sort.title',
};

interface EventListPanelProps {
  /** Already narrowed to the visible layers and in the active sort. */
  places: readonly RawMarkerData[];
  /** From `useWindowClock`, so every row's pill re-derives at a boundary together. */
  now: number;
  onSelectPlace: (place: RawMarkerData) => void;
}

export function EventListPanel({ places, now, onSelectPlace }: EventListPanelProps) {
  const { t, tpl } = useT();
  const sortId = useEventMapStore((s) => s.sortId);
  const setSortId = useEventMapStore((s) => s.setSortId);

  const renderItem = useCallback(
    ({ item }: { item: RawMarkerData }) => (
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
    <>
      <View style={styles.header}>
        <Txt typography="t5" fontWeight="bold">
          {tpl('eventmap.list.count', places.length)}
        </Txt>
      </View>

      <View style={styles.sortRow}>
        {PLACE_SORTS.map((sort) => (
          <FilterPill
            key={sort}
            label={t(SORT_LABEL[sort])}
            selected={sort === sortId}
            onPress={() => {
              logCampusContentSelect({ content_type: 'eventmap_sort', item_id: sort });
              setSortId(sort);
            }}
          />
        ))}
      </View>

      <BottomSheetFlatList
        data={places as RawMarkerData[]}
        keyExtractor={(item: RawMarkerData) => item.id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Txt typography="t6" color={SdsColors.grey500}>
              {t('eventmap.list.empty')}
            </Txt>
          </View>
        }
      />
    </>
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
  header: {
    paddingHorizontal: GUTTER,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: GUTTER,
    paddingBottom: 12,
  },
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: { paddingHorizontal: GUTTER, paddingBottom: 32 },
  row: { paddingVertical: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: SdsColors.grey200 },
  empty: { paddingTop: 40, alignItems: 'center' },
});
