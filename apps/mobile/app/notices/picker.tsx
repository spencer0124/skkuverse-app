/**
 * Notices source picker — native iOS form-sheet route for editing which
 * sources a picker tab subscribes to (학과 / 도서관 / 기숙사 / 일반).
 *
 * Why a route instead of a bottom sheet
 * ─────────────────────────────────────
 *   The previous gorhom BottomSheetModal was JS-rendered, fixed at 50%
 *   height, no search, and prevented unchecking the last selected item.
 *   This route uses `presentation: 'formSheet'` (registered in
 *   app/_layout.tsx) which on iOS 16+ maps to UISheetPresentationController
 *   — system blur, native swipe-down, peek detents [0.8, 1.0]. Android
 *   falls back to a regular full-screen modal (no native partial sheet).
 *
 * Why per-screen SafeAreaProvider
 * ───────────────────────────────
 *   formSheet routes mount in a separate UIViewController. The root
 *   SafeAreaProvider measures the parent VC, not the sheet — first paint
 *   loses top safe area without a per-modal wrap. See
 *   `docs/ios-modal-safe-area-provider.md`.
 *
 * Selection model (restore-on-dismiss is free)
 * ────────────────────────────────────────────
 *   - `originalIds` snapshot taken on mount from `pickerSelections[tabKey]`.
 *   - `pending` is the local edit buffer, freely mutated.
 *   - User CAN uncheck the last item — no min-1 enforcement during editing.
 *     "완료" is disabled when `pending.length === 0` so an empty selection
 *     can't be committed (would break the picker UX with no sources to
 *     fetch). Dismiss via swipe-down / Close X / back simply doesn't write
 *     to Firestore → natural restore to originalIds.
 *
 * Grouping
 * ────────
 *   - tabKey === 'dept': split candidates by primary's college via
 *     `recommendCollegeMates` ("같은 단과대학" + "기타 학과") — same helper
 *     onboarding's InterestDeptStep uses.
 *   - other picker tabs: split by `source.campus` relative to user's
 *     `preferredCampus` ("인사캠" + "자과캠" with user's first).
 *
 * Selected items appear as removable chips above the search field — quick
 * one-tap removal without scrolling to the row.
 */

import { useMemo, useState } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { XIcon } from 'phosphor-react-native';
import {
  filterPickerSources,
  recommendCollegeMates,
  resolvePickerSelection,
  SdsColors,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useSettingsStore,
  useT,
  type Campus,
  type TabSource,
  type TranslationKey,
} from '@skkuverse/shared';
import { SearchField, Txt } from '@skkuverse/sds';
import { DeptRow } from '@/features/onboarding/components/DeptRow';
import { setPickerSelectionRemote } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';

interface PickerSection {
  title: string;
  data: TabSource[];
}

const DEEPGREEN = '#1f3d2e';

// Static map so the campus header key is type-checked rather than built
// via dynamic string concatenation (which would fall outside the
// TranslationKey union).
const CAMPUS_HEADER_KEY: Record<Campus, TranslationKey> = {
  hssc: 'campus.hssc',
  nsc: 'campus.nsc',
};

function NoticesPickerScreenInner() {
  const router = useRouter();
  const { tabKey } = useLocalSearchParams<{ tabKey: string }>();
  const { t, tpl } = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const chipMaxWidth = Math.min(Math.round(screenW * 0.6), 360);

  const { data: tabsConfig } = useNoticeTabs();
  const tab = useMemo(
    () => tabsConfig?.tabs.find((tt) => tt.key === tabKey) ?? null,
    [tabsConfig, tabKey],
  );

  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const subscriptionUid = !isAnonymous ? uid : null;

  const primaryDeptId = useSettingsStore((s) => s.primaryDeptId);
  const preferredCampus = useSettingsStore((s) => s.preferredCampus);

  // Snapshot the saved selection ONCE at mount. Lazy initializer reads
  // from the current Firestore-backed store value; later changes from the
  // listener don't reset us (would clobber in-progress edits).
  const [originalIds] = useState<string[]>(() => {
    if (!tab || tab.tabMode !== 'picker' || !tab.picker) return [];
    return resolvePickerSelection(tab, pickerSelections[tab.key]);
  });
  const [pending, setPending] = useState<string[]>(originalIds);
  const [query, setQuery] = useState('');

  const sources = useMemo<TabSource[]>(
    () =>
      tab?.tabMode === 'picker' && tab.picker
        ? filterPickerSources(tab.picker.sources, { showUnsupported: false })
        : [],
    [tab],
  );

  const sourceById = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );

  const maxSelection =
    tab?.tabMode === 'picker' && tab.picker ? tab.picker.maxSelection : 1;

  // Search filter (substring on source.name).
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return sources;
    return sources.filter((s) => s.name.includes(q));
  }, [sources, query]);

  // Sections: dept tab → college-grouped, others → campus-grouped.
  // Empty sections array → SectionList renders ListEmptyComponent.
  const sections = useMemo<PickerSection[]>(() => {
    if (!tab || filtered.length === 0) return [];
    if (tab.key === 'dept') {
      const primary = primaryDeptId
        ? sources.find((s) => s.id === primaryDeptId) ?? null
        : null;
      const { recommended, others } = recommendCollegeMates(primary, filtered);
      const out: PickerSection[] = [];
      if (recommended.length > 0) {
        out.push({
          title: t('onboarding.interestDept.recommendedSection'),
          data: recommended,
        });
      }
      out.push({
        title:
          recommended.length > 0
            ? t('onboarding.interestDept.othersSection')
            : '',
        data: others,
      });
      return out;
    }
    // Campus-grouped (library / dorm / general): both → user's → other.
    // 'both' (or null, normalized to 'both' by parser) goes to its own
    // section so dual-campus items aren't visually misclassified into a
    // single campus bucket.
    const otherCampus: Campus = preferredCampus === 'hssc' ? 'nsc' : 'hssc';
    const bothBucket: TabSource[] = [];
    const userBucket: TabSource[] = [];
    const otherBucket: TabSource[] = [];
    for (const src of filtered) {
      if (src.campus === 'both' || src.campus == null) {
        bothBucket.push(src);
      } else if (src.campus === preferredCampus) {
        userBucket.push(src);
      } else {
        otherBucket.push(src);
      }
    }
    const sectionCount =
      (bothBucket.length > 0 ? 1 : 0) +
      (userBucket.length > 0 ? 1 : 0) +
      (otherBucket.length > 0 ? 1 : 0);
    const showHeaders = sectionCount > 1;
    const out: PickerSection[] = [];
    if (bothBucket.length > 0) {
      out.push({
        title: showHeaders ? t('campus.both') : '',
        data: bothBucket,
      });
    }
    if (userBucket.length > 0) {
      out.push({
        title: showHeaders ? t(CAMPUS_HEADER_KEY[preferredCampus]) : '',
        data: userBucket,
      });
    }
    if (otherBucket.length > 0) {
      out.push({
        title: showHeaders ? t(CAMPUS_HEADER_KEY[otherCampus]) : '',
        data: otherBucket,
      });
    }
    return out;
  }, [tab, filtered, primaryDeptId, preferredCampus, sources, t]);

  const handleToggle = (id: string) => {
    setPending((prev) => {
      if (prev.includes(id)) {
        // No min-1 enforcement during editing — the "완료" button below
        // blocks committing an empty selection.
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= maxSelection) return prev;
      return [...prev, id];
    });
  };

  const canConfirm = pending.length > 0;

  const handleConfirm = () => {
    if (!canConfirm || !tab || !subscriptionUid) return;
    setPickerSelectionRemote(subscriptionUid, tab.key, pending).catch((e) => {
      logHandledError('notifications/picker-set', e);
    });
    router.back();
  };

  const handleClose = () => router.back();

  const counterLabel = tpl(
    'notices.picker.selectedHeader',
    pending.length,
    maxSelection,
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar — Close (left), title + counter (center), 완료 (right).
          formSheet has a native grabber on iOS 16+, but Android has no
          partial-sheet equivalent so we always show the explicit X to keep
          the flow legible cross-platform. */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 8 : 14 }]}>
        <Pressable
          onPress={handleClose}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <XIcon size={22} color={SdsColors.grey900} />
        </Pressable>
        <View style={styles.titleWrap} pointerEvents="none">
          <Txt
            typography="t5"
            fontWeight="bold"
            color={SdsColors.grey900}
            numberOfLines={1}
          >
            {tab?.label ?? ''}
          </Txt>
          <Txt typography="t7" color={SdsColors.grey500} style={styles.counter}>
            {counterLabel}
          </Txt>
        </View>
        <Pressable
          onPress={handleConfirm}
          disabled={!canConfirm}
          hitSlop={10}
          style={({ pressed }) => [
            styles.doneBtn,
            pressed && canConfirm && styles.doneBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canConfirm }}
        >
          <Txt
            typography="t6"
            fontWeight="semiBold"
            color={canConfirm ? DEEPGREEN : SdsColors.grey300}
          >
            {t('notices.done')}
          </Txt>
        </Pressable>
      </View>

      {/* Selected chips — solid deepgreen pill with white X for one-tap
          removal. Hidden when nothing is selected. Wraps to multiple rows
          on overflow. NOTE: this was previously a horizontal ScrollView,
          but iOS UISheetPresentationController auto-binds its dismiss
          gesture to the first UIScrollView discovered depth-first inside
          the sheet — when the chips ScrollView existed, that binding
          stole the vertical pan from the SectionList below, breaking list
          scroll (react-native-screens issues #2693, #2424). Using a plain
          View with flexWrap leaves the SectionList as the sole inner
          UIScrollView so the system bound gesture goes where intended. */}
      {pending.length > 0 && (
        <View style={[styles.chipsWrap, styles.chipsRow]}>
          {pending.map((id) => {
            const src = sourceById.get(id);
            if (!src) return null;
            return (
              <Pressable
                key={id}
                onPress={() => handleToggle(id)}
                style={({ pressed }) => [
                  styles.chip,
                  { maxWidth: chipMaxWidth },
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${src.name} 제거`}
              >
                <Txt
                  typography="t7"
                  fontWeight="semiBold"
                  color="#FFFFFF"
                  numberOfLines={1}
                >
                  {src.name}
                </Txt>
                <XIcon size={12} color="#FFFFFF" weight="bold" />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.searchWrap}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={
            tab?.key === 'dept'
              ? t('onboarding.deptSearchPlaceholder')
              : t('notices.picker.searchPlaceholder')
          }
          hasClearButton
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* collapsable={false} on the wrapper defeats RN's native view
          flattening so react-native-screens' formSheet sheet-controller
          can find this ScrollView via its linear DOM walk (issue #2424,
          maintainer-verified workaround). Without it, SectionList vertical
          pan is silently swallowed by the sheet's pan gesture. Paired with
          the multi-detent config in app/_layout.tsx for redundancy — same
          known bug, two community workarounds that hit on different cases. */}
      <View collapsable={false} style={styles.list}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = pending.includes(item.id);
            const atMax = pending.length >= maxSelection;
            return (
              <DeptRow
                name={item.name}
                selected={isSelected}
                disabled={atMax && !isSelected}
                variant="checkbox"
                onPress={() => handleToggle(item.id)}
              />
            );
          }}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Txt
                typography="t7"
                fontWeight="semiBold"
                color={SdsColors.grey500}
                style={styles.sectionHeader}
              >
                {section.title}
              </Txt>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Txt typography="t7" color={SdsColors.grey400}>
                {t('notices.picker.empty')}
              </Txt>
            </View>
          }
          stickySectionHeadersEnabled={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      </View>
    </View>
  );
}

export default function NoticesPickerScreen() {
  return (
    <SafeAreaProvider>
      <NoticesPickerScreenInner />
    </SafeAreaProvider>
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
    paddingBottom: 10,
    minHeight: 52,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    marginTop: 2,
  },
  doneBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  doneBtnPressed: {
    opacity: 0.6,
  },
  chipsWrap: {
    paddingBottom: 8,
  },
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
    rowGap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DEEPGREEN,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    gap: 6,
  },
  chipPressed: {
    opacity: 0.75,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  emptyWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
});
