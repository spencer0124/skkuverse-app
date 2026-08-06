/**
 * Building/space search screen.
 *
 * SearchHeader (back + TextInput, autoFocus, 500ms debounce)
 * SegmentedControl (전체 / 인사캠 / 자과캠)
 * Collapsible sections with ListHeader: 건물 / 공간
 *
 * On item tap: set BuildingNavPayload in store, call router.back()
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Platform,
  View,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItem,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import {
  XCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CaretDownIcon,
  CaretRightIcon,
} from 'phosphor-react-native';
import {
  useSearchBuildings,
  SdsColors,
  SdsTypo,
  SdsSpacing,
  useT,
  type Building,
  type SpaceGroup,
  type SearchSpaceItem,
  type BuildingNavPayload,
  getLocalizedText,
  floorBadge,
  useSettingsStore,
} from '@skkuverse/shared';
import { Badge, ListHeader, SegmentedControl, Txt } from '@skkuverse/sds';
import { useSearchResultStore } from './store';
import {
  logSearchPerform,
  logSearchResultTap,
  logSearchFilterChange,
  logSearchContentSelect,
} from '@/services/analytics';

type CampusFilter = 'all' | 'hssc' | 'nsc';

/** Flattened space item with parent group reference */
type FlatSpaceItem = SearchSpaceItem & { group: SpaceGroup };

/**
 * One row of the virtualized results list.
 *
 * Section headers and dividers are rows too, so both sections live in a single
 * FlatList and every row is windowed. Collapsing a section simply drops its
 * item rows from the array.
 */
type ListRow =
  | { kind: 'buildingHeader' }
  | { kind: 'building'; building: Building }
  | { kind: 'divider' }
  | { kind: 'spaceHeader' }
  | { kind: 'space'; space: FlatSpaceItem };

const DEBOUNCE_MS = 500;

const GLASS_AVAILABLE = isLiquidGlassAvailable();
const CAMPUS_FILTER_IDS: CampusFilter[] = ['all', 'hssc', 'nsc'];

export function SearchScreen() {
  const { t, tpl } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useSettingsStore((s) => s.appLanguage);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [buildingExpanded, setBuildingExpanded] = useState(true);
  const [spaceExpanded, setSpaceExpanded] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPendingNavPayload = useSearchResultStore(
    (s) => s.setPendingNavPayload,
  );

  const [campusFilter, setCampusFilter] = useState<CampusFilter>('all');
  const campus = campusFilter === 'all' ? undefined : campusFilter;
  const { data } = useSearchBuildings(debouncedQuery, campus);
  // Fetch without campus filter to get per-campus counts for tab badges.
  // When campusFilter is 'all', this shares the same queryKey → no extra request.
  const { data: countData } = useSearchBuildings(debouncedQuery, undefined);
  const lastLoggedQuery = useRef<string>('');

  // Reset collapse state when search query or campus filter changes
  useEffect(() => {
    setBuildingExpanded(true);
    setSpaceExpanded(true);
  }, [debouncedQuery, campusFilter]);

  // ── Analytics: log search when results arrive ──
  useEffect(() => {
    if (!debouncedQuery || !data || debouncedQuery === lastLoggedQuery.current) return;
    lastLoggedQuery.current = debouncedQuery;
    logSearchPerform({
      query: debouncedQuery,
      buildingResults: data.buildings.length,
      spaceResults: data.spaces.reduce((sum, g) => sum + g.items.length, 0),
      campusFilter: campusFilter,
    });
  }, [debouncedQuery, data, campusFilter]);

  /** Cancels a pending debounce so a stale keystroke cannot land later. */
  const cancelPendingQuery = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputValue(text);
      cancelPendingQuery();
      const trimmed = text.trim();
      // Clearing the field applies immediately — waiting 500ms to show "no
      // query" reads as lag, and there is no request to coalesce.
      if (trimmed.length === 0) {
        setDebouncedQuery('');
        return;
      }
      timerRef.current = setTimeout(() => {
        setDebouncedQuery(trimmed);
      }, DEBOUNCE_MS);
    },
    [cancelPendingQuery],
  );

  // Without this, a timer armed by the last keystroke fires after the screen is
  // gone and sets state on an unmounted component.
  useEffect(() => cancelPendingQuery, [cancelPendingQuery]);

  const handleBuildingTap = useCallback(
    (building: Building) => {
      logSearchResultTap({
        resultType: 'building',
        resultName: getLocalizedText(building.name, lang),
        campus: building.campus,
        skkuId: building.skkuId,
      });
      const payload: BuildingNavPayload = {
        skkuId: building.skkuId,
        lat: building.lat,
        lng: building.lng,
        campus: building.campus,
      };
      setPendingNavPayload(payload);
      router.back();
    },
    [setPendingNavPayload, router, lang],
  );

  const handleSpaceTap = useCallback(
    (group: SpaceGroup, spaceCd: string, floor: string) => {
      if (group.skkuId == null) return;
      logSearchResultTap({
        resultType: 'space',
        resultName: getLocalizedText(group.buildingName, lang),
        campus: group.campus,
        skkuId: group.skkuId,
      });
      const payload: BuildingNavPayload = {
        skkuId: group.skkuId,
        lat: 0,
        lng: 0,
        campus: group.campus,
        highlightSpaceCd: spaceCd,
        highlightFloor: floor,
      };
      setPendingNavPayload(payload);
      router.back();
    },
    [setPendingNavPayload, router, lang],
  );

  const flatSpaces = useMemo<FlatSpaceItem[]>(() => {
    if (!data) return [];
    return data.spaces.flatMap((group) =>
      group.items.map((item) => ({ ...item, group })),
    );
  }, [data]);

  const hasBuildings = data && data.buildings.length > 0;
  const hasSpaces = data && flatSpaces.length > 0;
  const noQuery = debouncedQuery.length === 0;
  const noResults = !noQuery && data && !hasBuildings && !hasSpaces;

  const listRows = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];
    if (hasBuildings && data) {
      rows.push({ kind: 'buildingHeader' });
      if (buildingExpanded) {
        for (const building of data.buildings) rows.push({ kind: 'building', building });
      }
    }
    if (hasSpaces) {
      if (rows.length > 0) rows.push({ kind: 'divider' });
      rows.push({ kind: 'spaceHeader' });
      if (spaceExpanded) {
        for (const space of flatSpaces) rows.push({ kind: 'space', space });
      }
    }
    return rows;
  }, [data, hasBuildings, hasSpaces, buildingExpanded, spaceExpanded, flatSpaces]);

  const rowKey = useCallback((row: ListRow, index: number): string => {
    switch (row.kind) {
      case 'building':
        return `b-${row.building.skkuId}`;
      case 'space':
        // spaceCd is unique per building, not globally, so the group qualifies
        // it; index keeps the key stable if the API ever repeats a pair.
        return `s-${row.space.group.buildNo}-${row.space.spaceCd}-${index}`;
      default:
        return `${row.kind}-${index}`;
    }
  }, []);

  const renderRow = useCallback<ListRenderItem<ListRow>>(
    ({ item }) => {
      switch (item.kind) {
        case 'divider':
          return <View style={styles.sectionDivider} />;

        case 'buildingHeader':
          return (
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  {t('building.building')}
                </ListHeader.TitleParagraph>
              }
              right={
                <View style={styles.sectionRight}>
                  <Txt typography="t7" fontWeight="regular" color={SdsColors.grey400}>
                    {data?.buildingCount}
                  </Txt>
                  {buildingExpanded ? (
                    <CaretDownIcon size={16} color={SdsColors.grey400} />
                  ) : (
                    <CaretRightIcon size={16} color={SdsColors.grey400} />
                  )}
                </View>
              }
              onPress={() => {
                logSearchContentSelect({
                  content_type: 'section_buildings_toggle',
                  item_id: buildingExpanded ? 'collapse' : 'expand',
                });
                setBuildingExpanded((prev) => !prev);
              }}
            />
          );

        case 'spaceHeader':
          return (
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  {t('building.space')}
                </ListHeader.TitleParagraph>
              }
              right={
                <View style={styles.sectionRight}>
                  <Txt typography="t7" fontWeight="regular" color={SdsColors.grey400}>
                    {data?.spaceCount}
                  </Txt>
                  {spaceExpanded ? (
                    <CaretDownIcon size={16} color={SdsColors.grey400} />
                  ) : (
                    <CaretRightIcon size={16} color={SdsColors.grey400} />
                  )}
                </View>
              }
              onPress={() => {
                logSearchContentSelect({
                  content_type: 'section_spaces_toggle',
                  item_id: spaceExpanded ? 'collapse' : 'expand',
                });
                setSpaceExpanded((prev) => !prev);
              }}
            />
          );

        case 'building':
          return (
            <Pressable
              style={styles.resultRow}
              onPress={() => handleBuildingTap(item.building)}
            >
              <View style={styles.buildingBadge}>
                <Txt typography="t7" fontWeight="bold" color={SdsColors.grey600}>
                  {item.building.displayNo ?? '#'}
                </Txt>
              </View>
              <View style={styles.resultTexts}>
                <Txt typography="t6" fontWeight="regular">
                  {getLocalizedText(item.building.name, lang)}
                </Txt>
                <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
                  {item.building.campusLabel}
                </Txt>
              </View>
            </Pressable>
          );

        case 'space':
          return (
            <Pressable
              style={styles.resultRow}
              onPress={() =>
                handleSpaceTap(
                  item.space.group,
                  item.space.spaceCd,
                  item.space.floor.ko,
                )
              }
            >
              <View style={styles.buildingBadge}>
                <Txt typography="t7" fontWeight="bold" color={SdsColors.grey600}>
                  {floorBadge(getLocalizedText(item.space.floor, lang))}
                </Txt>
              </View>
              <View style={styles.resultTexts}>
                <Txt typography="t6" fontWeight="regular">
                  {getLocalizedText(item.space.name, lang)}
                </Txt>
                <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
                  {getLocalizedText(item.space.group.buildingName, lang)}
                </Txt>
              </View>
              <Badge
                size="tiny"
                color={SdsColors.grey400}
                backgroundColor={SdsColors.grey100}
              >
                {item.space.spaceCd}
              </Badge>
            </Pressable>
          );
      }
    },
    [
      data,
      lang,
      t,
      buildingExpanded,
      spaceExpanded,
      handleBuildingTap,
      handleSpaceTap,
    ],
  );

  const segmentedLabels = useMemo(() => {
    const showCount = !!(countData && debouncedQuery);
    const total = countData ? countData.counts.building.total + countData.counts.space.total : 0;
    const hssc = countData ? countData.counts.building.hssc + countData.counts.space.hssc : 0;
    const nsc = countData ? countData.counts.building.nsc + countData.counts.space.nsc : 0;
    return [
      showCount ? `${t('common.total')} ${total}` : t('common.total'),
      showCount ? `${t('campus.hssc')} ${hssc}` : t('campus.hssc'),
      showCount ? `${t('campus.nsc')} ${nsc}` : t('campus.nsc'),
    ];
  }, [countData, debouncedQuery, t]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search field */}
      <View style={styles.searchFieldWrapper}>
        <View style={styles.searchField}>
          <MagnifyingGlassIcon size={18} color={SdsColors.grey500} />
          <TextInput
            style={styles.input}
            placeholder={t('search.placeholder')}
            placeholderTextColor={SdsColors.grey400}
            value={inputValue}
            onChangeText={handleTextChange}
            autoFocus
            returnKeyType="search"
          />
          {inputValue.length > 0 && (
            <Pressable
              onPress={() => {
                logSearchContentSelect({ content_type: 'clear_button', item_id: 'x' });
                // Cancel first: a timer armed by the keystroke just before the
                // tap would otherwise fire 500ms later and restore the query
                // the user just cleared.
                cancelPendingQuery();
                setInputValue('');
                setDebouncedQuery('');
              }}
              hitSlop={8}
            >
              <XCircleIcon size={18} color={SdsColors.grey400} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Campus tab bar */}
      <View style={styles.segmentedWrapper}>
        {Platform.OS === 'ios' && GLASS_AVAILABLE ? (
          // iOS 26+ native UISegmentedControl (auto Liquid Glass at system level).
          // Mirrors bus/schedule.tsx + CampusToggle.tsx pattern.
          <NativeSegmentedControl
            values={segmentedLabels}
            selectedIndex={Math.max(0, CAMPUS_FILTER_IDS.indexOf(campusFilter))}
            onChange={(e) => {
              const idx = e.nativeEvent.selectedSegmentIndex;
              const filter = CAMPUS_FILTER_IDS[idx];
              if (!filter) return;
              logSearchFilterChange(filter);
              setCampusFilter(filter);
            }}
            style={styles.nativeSegmented}
          />
        ) : (
          <SegmentedControl
            value={campusFilter}
            onValueChange={(v) => {
              const filter = v as CampusFilter;
              logSearchFilterChange(filter);
              setCampusFilter(filter);
            }}
          >
            <SegmentedControl.Item value="all" typography="t7" style={styles.segmentedItem}>
              {segmentedLabels[0]}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="hssc" typography="t7" style={styles.segmentedItem}>
              {segmentedLabels[1]}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="nsc" typography="t7" style={styles.segmentedItem}>
              {segmentedLabels[2]}
            </SegmentedControl.Item>
          </SegmentedControl>
        )}
      </View>

      {/* Empty states */}
      {noQuery && (
        <View style={styles.emptyContainer}>
          <MapPinIcon size={40} color={SdsColors.grey300} weight="thin" />
          <Txt typography="t6" fontWeight="regular" color={SdsColors.grey400} style={styles.emptyText}>
            {t('search.emptyPrompt')}
          </Txt>
        </View>
      )}

      {noResults && (
        <View style={styles.emptyContainer}>
          <MagnifyingGlassIcon size={48} color={SdsColors.grey300} />
          <Txt typography="t6" fontWeight="medium" color={SdsColors.grey400} style={styles.emptyText}>
            {tpl('search.noResult', debouncedQuery)}
          </Txt>
          <Txt typography="t7" fontWeight="regular" color={SdsColors.grey400}>
            {t('search.noResultHint')}
          </Txt>
        </View>
      )}

      {/* Results */}
      {!noQuery && !noResults && (
        <FlatList
          data={listRows}
          keyExtractor={rowKey}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          contentContainerStyle={styles.list}
          // Virtualized because the server returns every room of a building —
          // 168 for building 27, 801 for 기숙사신관, and ~1000 for a bare "2"
          // while the user is still typing a room code. The previous ScrollView
          // mounted all of them eagerly (~8 elements per row), which froze the
          // UI on short queries.
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchFieldWrapper: {
    paddingHorizontal: SdsSpacing.base,
    paddingBottom: SdsSpacing.sm,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SdsColors.grey50,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: SdsTypo.t5.fontFamily,
    fontSize: SdsTypo.t5.fontSize,
    fontWeight: SdsTypo.t5.fontWeight,
    color: SdsColors.grey900,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  segmentedWrapper: {
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.sm,
  },
  segmentedItem: {
    paddingVertical: 5,
  },
  nativeSegmented: {
    alignSelf: 'stretch',
  },
  list: {
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.base,
    gap: 8,
    flexGrow: 1,
  },
  emptyText: {
    marginTop: 12,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionDivider: {
    height: SdsSpacing.sm,
    backgroundColor: SdsColors.grey50,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
  },
  buildingBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTexts: {
    flex: 1,
    gap: 2,
  },
});
