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
  View,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  XCircle,
  Search,
  MapPin,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
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
import { Badge, ListHeader, Navbar, SegmentedControl, Txt } from '@skkuverse/sds';
import { useSearchResultStore } from './store';
import {
  logSearchPerform,
  logSearchResultTap,
  logSearchFilterChange,
} from '@/services/analytics';

type CampusFilter = 'all' | 'hssc' | 'nsc';

/** Flattened space item with parent group reference */
type FlatSpaceItem = SearchSpaceItem & { group: SpaceGroup };

const DEBOUNCE_MS = 500;

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

  const handleTextChange = useCallback((text: string) => {
    setInputValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, DEBOUNCE_MS);
  }, []);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search field */}
      <View style={styles.searchFieldWrapper}>
        <View style={styles.searchField}>
          <Search size={18} color={SdsColors.grey500} />
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
                setInputValue('');
                setDebouncedQuery('');
              }}
              hitSlop={8}
            >
              <XCircle size={18} color={SdsColors.grey400} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Campus tab bar */}
      <View style={styles.segmentedWrapper}>
        <SegmentedControl
          value={campusFilter}
          onValueChange={(v) => {
            const filter = v as CampusFilter;
            logSearchFilterChange(filter);
            setCampusFilter(filter);
          }}
        >
          <SegmentedControl.Item value="all" typography="t7" style={styles.segmentedItem}>
            {countData && debouncedQuery
              ? `${t('common.total')} ${countData.counts.building.total + countData.counts.space.total}`
              : t('common.total')}
          </SegmentedControl.Item>
          <SegmentedControl.Item value="hssc" typography="t7" style={styles.segmentedItem}>
            {countData && debouncedQuery
              ? `${t('campus.hssc')} ${countData.counts.building.hssc + countData.counts.space.hssc}`
              : t('campus.hssc')}
          </SegmentedControl.Item>
          <SegmentedControl.Item value="nsc" typography="t7" style={styles.segmentedItem}>
            {countData && debouncedQuery
              ? `${t('campus.nsc')} ${countData.counts.building.nsc + countData.counts.space.nsc}`
              : t('campus.nsc')}
          </SegmentedControl.Item>
        </SegmentedControl>
      </View>

      {/* Empty states */}
      {noQuery && (
        <View style={styles.emptyContainer}>
          <MapPin size={40} color={SdsColors.grey300} strokeWidth={1.5} />
          <Txt typography="t6" fontWeight="regular" color={SdsColors.grey400} style={styles.emptyText}>
            {t('search.emptyPrompt')}
          </Txt>
        </View>
      )}

      {noResults && (
        <View style={styles.emptyContainer}>
          <Search size={48} color={SdsColors.grey300} />
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          bounces={false}
          contentContainerStyle={styles.list}
        >
          {/* ── Building section ── */}
          {hasBuildings && (
            <>
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                    {t('building.building')}
                  </ListHeader.TitleParagraph>
                }
                right={
                  <View style={styles.sectionRight}>
                    <Txt typography="t7" fontWeight="regular" color={SdsColors.grey400}>
                      {data.buildingCount}
                    </Txt>
                    {buildingExpanded ? (
                      <ChevronDown size={16} color={SdsColors.grey400} />
                    ) : (
                      <ChevronRight size={16} color={SdsColors.grey400} />
                    )}
                  </View>
                }
                onPress={() => setBuildingExpanded((prev) => !prev)}
              />
              {buildingExpanded && (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(100)}
                >
                  {data.buildings.map((building) => (
                    <Pressable
                      key={building.skkuId}
                      style={styles.resultRow}
                      onPress={() => handleBuildingTap(building)}
                    >
                      <View style={styles.buildingBadge}>
                        <Txt typography="t7" fontWeight="bold" color={SdsColors.grey600}>
                          {building.displayNo ?? '#'}
                        </Txt>
                      </View>
                      <View style={styles.resultTexts}>
                        <Txt typography="t6" fontWeight="regular">
                          {getLocalizedText(building.name, lang)}
                        </Txt>
                        <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
                          {building.campusLabel}
                        </Txt>
                      </View>
                    </Pressable>
                  ))}
                </Animated.View>
              )}
            </>
          )}

          {/* ── Space section ── */}
          {hasSpaces && (
            <>
              <View style={styles.sectionDivider} />
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                    {t('building.space')}
                  </ListHeader.TitleParagraph>
                }
                right={
                  <View style={styles.sectionRight}>
                    <Txt typography="t7" fontWeight="regular" color={SdsColors.grey400}>
                      {data.spaceCount}
                    </Txt>
                    {spaceExpanded ? (
                      <ChevronDown size={16} color={SdsColors.grey400} />
                    ) : (
                      <ChevronRight size={16} color={SdsColors.grey400} />
                    )}
                  </View>
                }
                onPress={() => setSpaceExpanded((prev) => !prev)}
              />
              {spaceExpanded && (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(100)}
                >
                  {flatSpaces.map((space, i) => (
                    <Pressable
                      key={`${space.group.buildNo}-${space.spaceCd}-${i}`}
                      style={styles.resultRow}
                      onPress={() =>
                        handleSpaceTap(
                          space.group,
                          space.spaceCd,
                          space.floor.ko,
                        )
                      }
                    >
                      <View style={styles.buildingBadge}>
                        <Txt typography="t7" fontWeight="bold" color={SdsColors.grey600}>
                          {floorBadge(getLocalizedText(space.floor, lang))}
                        </Txt>
                      </View>
                      <View style={styles.resultTexts}>
                        <Txt typography="t6" fontWeight="regular">
                          {getLocalizedText(space.name, lang)}
                        </Txt>
                        <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
                          {getLocalizedText(space.group.buildingName, lang)}
                        </Txt>
                      </View>
                      <Badge
                        size="tiny"
                        color={SdsColors.grey400}
                        backgroundColor={SdsColors.grey100}
                      >
                        {space.spaceCd}
                      </Badge>
                    </Pressable>
                  ))}
                </Animated.View>
              )}
            </>
          )}
        </ScrollView>
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
