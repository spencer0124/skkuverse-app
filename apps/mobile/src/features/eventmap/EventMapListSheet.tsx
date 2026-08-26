/**
 * Browsable list of the items the current chips admit.
 *
 * This is the only surface on which a sort is observable. Pins are positional,
 * and the order of items inside one pin's peek sheet is fixed by
 * `compareForStack` — so without a list, `snapshot.sorts` is data the app
 * receives and can never act on. That is also why the sort control lives here
 * rather than in `FilterSheet`: a sort selector next to the filters would be a
 * control with no visible effect, the same dead-control shape the distance sort
 * is deliberately hidden to avoid.
 *
 * Rows are `compact` cards — same template, same resolver, thumbnail and tags
 * suppressed. Reusing the renderer means a template change shows up in both
 * places, instead of the list quietly drifting into its own layout.
 */

import { forwardRef, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
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

interface EventMapListSheetProps {
  items: readonly DerivedItem[];
  sorts: readonly EventMapSort[];
  cardTemplates: Map<string, EventMapCardTemplate>;
  onSelectItem: (stackKey: string) => void;
}

export const EventMapListSheet = forwardRef<BottomSheetModal, EventMapListSheetProps>(
  function EventMapListSheet({ items, sorts, cardTemplates, onSelectItem }, ref) {
    const snapPoints = useMemo(() => ['50%', '85%'], []);
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
            onSelectItem(item.stackKey);
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
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        handleIndicatorStyle={styles.handleIndicator}
        // Same reason as the peek sheet: the default 'switch' would minimise
        // whatever sheet is already up and resurface it when this one closes.
        stackBehavior="replace"
      >
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
      </BottomSheetModal>
    );
  },
);

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { paddingVertical: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: SdsColors.grey200 },
  empty: { paddingTop: 40, alignItems: 'center' },
  handleIndicator: {
    backgroundColor: SdsColors.grey300,
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
