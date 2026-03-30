/**
 * Building/space search screen.
 *
 * SearchHeader (back + TextInput, autoFocus, 500ms debounce)
 * SummaryBar ("건물 N건, 공간 N건")
 * CampusTabBar (전체 / 인사캠 / 자과캠)
 * FlatList with BuildingResultRow / SpaceResultRow
 *
 * On item tap: set BuildingNavPayload in store, call router.back()
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItem,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useSearchBuildings,
  SdsColors,
  SdsTypo,
  SdsSpacing,
  type Building,
  type SpaceGroup,
  type BuildingNavPayload,
} from '@skkuverse/shared';
import { useSearchResultStore } from './store';
import { BuildingResultRow } from './components/BuildingResultRow';
import { SpaceResultRow } from './components/SpaceResultRow';

type CampusFilter = 'all' | 'hssc' | 'nsc';
type ResultItem =
  | { type: 'building'; data: Building }
  | { type: 'space'; data: { space: SpaceGroup; itemIndex: number } };

const CAMPUS_TABS: { key: CampusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'hssc', label: '인사캠' },
  { key: 'nsc', label: '자과캠' },
];

const DEBOUNCE_MS = 500;

export function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState<CampusFilter>('all');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPendingNavPayload = useSearchResultStore(
    (s) => s.setPendingNavPayload,
  );

  const campus = campusFilter === 'all' ? undefined : campusFilter;
  const { data } = useSearchBuildings(debouncedQuery, campus);

  const handleTextChange = useCallback((text: string) => {
    setInputValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, DEBOUNCE_MS);
  }, []);

  const handleBuildingTap = useCallback(
    (building: Building) => {
      const payload: BuildingNavPayload = {
        skkuId: building.skkuId,
        lat: building.lat,
        lng: building.lng,
        campus: building.campus,
      };
      setPendingNavPayload(payload);
      router.back();
    },
    [setPendingNavPayload, router],
  );

  const handleSpaceTap = useCallback(
    (group: SpaceGroup, spaceCd: string, floor: string) => {
      if (group.skkuId == null) return;
      const payload: BuildingNavPayload = {
        skkuId: group.skkuId,
        lat: 0, // Will be resolved from building detail
        lng: 0,
        campus: group.campus,
        highlightSpaceCd: spaceCd,
        highlightFloor: floor,
      };
      setPendingNavPayload(payload);
      router.back();
    },
    [setPendingNavPayload, router],
  );

  const items = useMemo<ResultItem[]>(() => {
    if (!data) return [];
    const result: ResultItem[] = [];
    for (const b of data.buildings) {
      result.push({ type: 'building', data: b });
    }
    for (const group of data.spaces) {
      for (let i = 0; i < group.items.length; i++) {
        result.push({ type: 'space', data: { space: group, itemIndex: i } });
      }
    }
    return result;
  }, [data]);

  const renderItem: ListRenderItem<ResultItem> = useCallback(
    ({ item }) => {
      if (item.type === 'building') {
        return (
          <BuildingResultRow
            building={item.data}
            onPress={() => handleBuildingTap(item.data)}
          />
        );
      }
      const { space: group, itemIndex } = item.data;
      const spaceItem = group.items[itemIndex]!;
      return (
        <SpaceResultRow
          space={spaceItem}
          group={group}
          onPress={() =>
            handleSpaceTap(group, spaceItem.spaceCd, spaceItem.floor.ko)
          }
        />
      );
    },
    [handleBuildingTap, handleSpaceTap],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={SdsColors.grey900} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="건물, 강의실 검색"
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
            <Ionicons
              name="close-circle"
              size={20}
              color={SdsColors.grey400}
            />
          </Pressable>
        )}
      </View>

      {/* Summary bar */}
      {data && debouncedQuery.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            건물 {data.buildingCount}건, 공간 {data.spaceCount}건
          </Text>
        </View>
      )}

      {/* Campus tab bar */}
      <View style={styles.tabBar}>
        {CAMPUS_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              campusFilter === tab.key && styles.tabActive,
            ]}
            onPress={() => setCampusFilter(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                campusFilter === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Results */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          item.type === 'building'
            ? `b-${item.data.skkuId}`
            : `s-${item.data.space.buildNo}-${item.data.itemIndex}`
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.sm,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: SdsColors.grey100,
  },
  input: {
    flex: 1,
    ...SdsTypo.t5,
    color: SdsColors.grey900,
    padding: 0,
  },
  summary: {
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.sm,
    backgroundColor: SdsColors.grey50,
  },
  summaryText: {
    ...SdsTypo.t7,
    color: SdsColors.grey500,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.sm,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: SdsColors.grey100,
  },
  tabActive: {
    backgroundColor: SdsColors.brand,
  },
  tabText: {
    ...SdsTypo.t7,
    color: SdsColors.grey600,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingBottom: 40,
  },
});
