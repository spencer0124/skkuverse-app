/**
 * Notices search screen — pushed when the accessory bar's search pill
 * is tapped. Mirrors iOS Mail / Settings search UX:
 *
 *   - Top: SearchField (autoFocus on mount; system keyboard rises naturally).
 *   - Body: NoticeListPanel scoped to whatever the user was viewing on the
 *     notices tab (fixed sourceId, or picker-selected sourceIds[]).
 *
 * Why a separate route (vs. an inline TextInput in the UITabAccessory):
 * react-native-screens 4.19 does not wire keyboard avoidance for the
 * iOS 26 UITabAccessory contentView (verified empirically on
 * feat/notices-search-prototype 2026-04-26). Routing into a normal RN
 * screen tree sidesteps the issue — the regular screen layout naturally
 * leaves room for the keyboard at the bottom.
 *
 * Scope mirroring: read directly from useNoticesUiStore.activeTabKey +
 * useNotificationStore.preferences.pickerSelections. Same resolvers
 * NoticesTabScreen uses, so a tab in "학과 picker" with [cs, sw] selected
 * lands here with sourceIds=['cs','sw']. No prop drilling, no nav params.
 *
 * Min-length gating: empty query / single Latin char skips the network
 * round-trip. Single Korean syllable (codepoint U+AC00..U+D7A3) is enough
 * — Korean carries enough information per syllable that 1 char produces
 * useful results (e.g. "공" already narrows by ~40%).
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeftIcon } from 'phosphor-react-native';
import {
  SdsColors,
  resolvePickerSelection,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { SearchField } from '@skkuverse/sds';
import { NoticeListPanel } from '@/features/notices/NoticeListPanel';
import { NoticeListSkeleton } from '@/features/notices/NoticeListSkeleton';
import { NoticeEmptyState } from '@/features/notices/EmptyState';
import { useNoticesUiStore } from '@/features/notices/store/noticesUiStore';

const DEBOUNCE_MS = 300;
const KOREAN_SYLLABLE_START = 0xac00;
const KOREAN_SYLLABLE_END = 0xd7a3;
const MIN_LATIN_LEN = 2;

// Local hook — debouncing the input keeps query keys stable while the
// user is mid-type. Lives here (not in shared) until a second consumer
// appears; promote to packages/shared/src/hooks if needed.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// Korean is informationally dense per syllable — 1 char already narrows
// usefully. Latin needs 2 chars or the result set explodes. Whitespace-
// only is treated as empty.
function isMinLengthMet(q: string): boolean {
  const trimmed = q.trim();
  if (trimmed.length === 0) return false;
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= KOREAN_SYLLABLE_START && cp <= KOREAN_SYLLABLE_END) return true;
  }
  return trimmed.length >= MIN_LATIN_LEN;
}

export default function NoticesSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  // Below the gate `effectiveQuery` is undefined and the body renders
  // blank — no network round-trip, no fallback feed. Results only appear
  // once the query meets the gate. Rationale: showing the unfiltered tab
  // feed on entry was visually indistinguishable from "search returned
  // everything", which misled users into thinking their query was being
  // ignored.
  const effectiveQuery = isMinLengthMet(debouncedQuery)
    ? debouncedQuery.trim()
    : undefined;

  // Scope mirror: read the same active tab + picker state the notices
  // tab is currently bound to.
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );
  const { data: tabsConfig, isLoading: isTabsLoading } = useNoticeTabs();

  const activeTab = useMemo(
    () => tabsConfig?.tabs.find((tab) => tab.key === activeTabKey),
    [tabsConfig, activeTabKey],
  );

  // Resolve sources from the active tab — mirror of NoticesTabScreen's
  // logic so the search scope is identical to what's visible on return.
  const sourceIds = useMemo<string[]>(() => {
    if (!activeTab) return [];
    if (activeTab.tabMode === 'picker' && activeTab.picker) {
      return resolvePickerSelection(
        activeTab,
        pickerSelections[activeTab.key],
      );
    }
    if (activeTab.tabMode === 'fixed' && activeTab.fixed) {
      return [activeTab.fixed.sourceId];
    }
    return [];
  }, [activeTab, pickerSelections]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <CaretLeftIcon size={26} color={SdsColors.grey900} />
        </Pressable>
        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t('notices.accessory.searchPlaceholder')}
            hasClearButton
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {isTabsLoading ? (
        <NoticeListSkeleton />
      ) : effectiveQuery === undefined ? (
        // Empty / below-min-length query → render nothing under the
        // search bar. Ordered before the sourceIds-empty guard so a
        // scope-less cold start also shows blank until the user types.
        <View style={styles.blank} />
      ) : sourceIds.length === 0 ? (
        // Edge case: cold-start direct nav to /notices/search before the
        // notices tab has been visited. activeTabKey unset → no scope to
        // search within. Send the user back to pick a tab first.
        <NoticeEmptyState
          message={t('notices.empty')}
          onRetry={() => router.back()}
        />
      ) : sourceIds.length === 1 ? (
        <NoticeListPanel sourceId={sourceIds[0]} q={effectiveQuery} />
      ) : (
        <NoticeListPanel sourceIds={sourceIds} q={effectiveQuery} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
    backgroundColor: SdsColors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flex: 1,
  },
  blank: {
    flex: 1,
  },
});
