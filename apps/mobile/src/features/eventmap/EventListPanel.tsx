/**
 * The event list, living in the campus sheet while a chip has narrowed the map.
 *
 * Rows are the items of the layers the map is drawing — `selectVisibleItems`
 * decides that, on the same `isLayerVisible` the render loop uses, so the list
 * and the pins cannot disagree about a layer. (A session outside its own time
 * window keeps its row, with a status badge, while its pin waits for the
 * window.) Which is also why this is a panel inside the
 * persistent sheet rather than a modal of its own: it describes the map the
 * user is looking at, and it goes away with the narrowing that produced it.
 *
 * This is the only surface on which a sort is observable. Pins are positional,
 * and the order of items inside one pin's peek sheet is fixed by
 * `compareForStack` — so without a list, `snapshot.sorts` is data the app
 * receives and can never act on. That is also why the sort control lives here
 * rather than in `FilterSheet`: a sort selector next to the filters would be a
 * control with no visible effect.
 *
 * Rows are `compact` cards — same template, same resolver, thumbnail and tags
 * suppressed. Reusing the renderer means a template change shows up in both
 * places, instead of the list quietly drifting into its own layout.
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
  resolveSlots,
  SdsColors,
  useEventMapStore,
  useT,
  type DerivedItem,
  type EventMapCardTemplate,
  type EventMapSort,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { FilterPill } from '@/features/map/components/FilterPill';
import { logCampusContentSelect } from '@/services/analytics';
import { CardRenderer } from './CardRenderer';

interface EventListPanelProps {
  /** Already narrowed to the visible layers and in the active sort. */
  items: readonly DerivedItem[];
  sorts: readonly EventMapSort[];
  cardTemplates: Map<string, EventMapCardTemplate>;
  onSelectItem: (item: DerivedItem) => void;
}

export function EventListPanel({ items, sorts, cardTemplates, onSelectItem }: EventListPanelProps) {
  const { t, tpl } = useT();
  const sortId = useEventMapStore((s) => s.sortId);
  const setSortId = useEventMapStore((s) => s.setSortId);

  const renderItem = useCallback(
    ({ item }: { item: DerivedItem }) => (
      <Pressable
        style={styles.row}
        accessibilityRole="button"
        onPress={() => {
          logCampusContentSelect({ content_type: 'eventmap_list_row', item_id: item.id });
          onSelectItem(item);
        }}
      >
        <CardRenderer
          slots={resolveSlots(cardTemplates.get(item.cardTemplateId), item)}
          status={item.status}
          variant="compact"
        />
      </Pressable>
    ),
    [cardTemplates, onSelectItem],
  );

  return (
    <>
      <View style={styles.header}>
        <Txt typography="t5" fontWeight="bold">
          {tpl('eventmap.list.count', items.length)}
        </Txt>
      </View>

      {sorts.length > 1 ? (
        <View style={styles.sortRow}>
          {sorts.map((sort) => (
            <FilterPill
              key={sort.id}
              label={sort.label}
              // Key off `id`, never `by`: ESKARA's 추천순 has id `manual` and
              // `by: 'order'`, so the two are not interchangeable.
              selected={sort.id === sortId}
              onPress={() => {
                logCampusContentSelect({ content_type: 'eventmap_sort', item_id: sort.id });
                setSortId(sort.id);
              }}
            />
          ))}
        </View>
      ) : null}

      <BottomSheetFlatList
        data={items as DerivedItem[]}
        keyExtractor={(item: DerivedItem) => item.id}
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
