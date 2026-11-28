import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { useActiveNoticeTab } from './useActiveNoticeTab';
import { useNoticesSearchPlaceholder } from './useNoticesSearchPlaceholder';
import { resolvePickerSelection } from './picker.rules';
import { useNoticeTabs } from './useNoticeTabs';

const DEBOUNCE_MS = 300;
const KOREAN_SYLLABLE_START = 0xac00;
const KOREAN_SYLLABLE_END = 0xd7a3;
const MIN_LATIN_LEN = 2;

// WHY: local until a second consumer appears; then it moves to packages/shared/src/utils.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// WHY: one Korean syllable already narrows usefully, while Latin needs two or the results explode.
function isMinLengthMet(q: string): boolean {
  const trimmed = q.trim();
  if (trimmed.length === 0) return false;
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= KOREAN_SYLLABLE_START && cp <= KOREAN_SYLLABLE_END) return true;
  }
  return trimmed.length >= MIN_LATIN_LEN;
}

export function useNoticeSearch() {
  const router = useRouter();
  const { t } = useT();
  const placeholder = useNoticesSearchPlaceholder();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  // WHY: below the gate the body stays blank; the unfiltered feed on entry looked like "search returned
  // everything" and misled users into thinking their query was ignored.
  const effectiveQuery = isMinLengthMet(debouncedQuery)
    ? debouncedQuery.trim()
    : undefined;

  const { activeTabKey } = useActiveNoticeTab();
  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );
  const { data: tabsConfig, isLoading: isTabsLoading } = useNoticeTabs();

  const activeTab = useMemo(
    () => tabsConfig?.tabs.find((tab) => tab.key === activeTabKey),
    [tabsConfig, activeTabKey],
  );

  // WHY: the same resolution as NoticesTabScreen, so the search scope matches the list on return.
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

  return {
    router,
    t,
    placeholder,
    query,
    effectiveQuery,
    sourceIds,
    isTabsLoading,
    onChangeQuery: setQuery,
  };
}
