/**
 * Notices source picker — full-screen modal route for editing which
 * sources a picker tab subscribes to (학과 / 도서관 / 기숙사 / 일반).
 *
 * Why fullScreenModal (and not formSheet)
 * ───────────────────────────────────────
 *   Previously this used `presentation: 'formSheet'` to get an iOS
 *   UISheetPresentationController with peek detents, but the inner
 *   SectionList wouldn't scroll due to react-native-screens issue #2424
 *   (PR #2436 unmerged) — RN view flattening breaks the sheet's linear
 *   ScrollView discovery on Paper architecture. Three workaround
 *   combinations were tried (single detent, chips ScrollView removal,
 *   collapsable+multi-detent+nestedScroll combo) — none worked. Switched
 *   to `presentation: 'fullScreenModal'` (UIModalPresentationFullScreen)
 *   which uses standard UIKit modal and is bug-free. UX cost: lose corner
 *   radius / grabber / swipe-down dismiss — explicit X button (header
 *   left) is the sole dismiss affordance. Revisit when #2424 is fixed
 *   upstream or after Fabric migration.
 *
 * Why per-screen SafeAreaProvider
 * ───────────────────────────────
 *   The modal mounts in a separate UIViewController. The root
 *   SafeAreaProvider measures the parent VC, not the modal — first paint
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
 *     fetch). Dismiss via Close X / back simply doesn't write to Firestore
 *     → natural restore to originalIds.
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
  findCollegeUmbrella,
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
import { UnsupportedDeptSheet } from '@/features/onboarding/components/UnsupportedDeptSheet';
import { setPickerSelectionRemote } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';
import { logNoticesContentSelect } from '@/services/analytics';

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
  const { t } = useT();
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

  // showUnsupported: true — unsupported depts used to be hidden here, but a
  // dept that silently vanishes from search reads as "app is broken / dept
  // doesn't exist". Now they render greyed with a warning marker and tapping
  // opens the same explanation sheet onboarding uses.
  const sources = useMemo<TabSource[]>(
    () =>
      tab?.tabMode === 'picker' && tab.picker
        ? filterPickerSources(tab.picker.sources, { showUnsupported: true })
        : [],
    [tab],
  );

  const [unsupportedTapped, setUnsupportedTapped] = useState<TabSource | null>(
    null,
  );
  const umbrella = useMemo(
    () =>
      unsupportedTapped ? findCollegeUmbrella(unsupportedTapped, sources) : null,
    [unsupportedTapped, sources],
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
    logNoticesContentSelect({
      content_type: 'picker_done',
      item_id: `${tab.key}/${pending.length}`,
    });
    setPickerSelectionRemote(subscriptionUid, tab.key, pending).catch((e) => {
      logHandledError('notifications/picker-set', e);
    });
    router.back();
  };

  const handleClose = () => {
    logNoticesContentSelect({
      content_type: 'picker_close',
      item_id: tab?.key ?? 'unknown',
    });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar — Close (left), title + counter (center), 완료 (right).
          fullScreenModal covers the status bar / Dynamic Island area, so
          add `insets.top` to the base padding — sheet-era conditional
          `insets.top > 0 ? 8 : 14` worked because formSheet auto-inset
          the sheet below the status bar, leaving useSafeAreaInsets().top
          ≈ 0 inside the sheet. fullScreenModal exposes the real status
          bar height so we have to absorb it ourselves. Note: titleWrap
          (absolute) mirrors this paddingTop inline — see its comment. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={handleClose}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <XIcon size={22} color={SdsColors.grey900} />
        </Pressable>
        <View
          style={[styles.titleWrap, { top: insets.top + 8, bottom: 10 }]}
          pointerEvents="none"
        >
          {/* Nested row: titleWrap handles vertical+horizontal centering
              within the absolute container (alignItems+justifyContent on
              column flex), the inner row owns inline layout + baseline
              alignment between the differently-sized title and counter.
              Compose-on-same-View previously broke this — titleRow's
              alignItems:baseline overrode titleWrap's alignItems:center,
              dragging the title to the container top and overlapping
              status bar / Dynamic Island.
              Inline top/bottom mirror the header's padding so the absolute
              box spans only the content row, not the safe-area inset
              region — otherwise Yoga anchors top:0 to the parent's outer
              box edge (above paddingTop), centering the title ~23px above
              the X/완료 row (which sit inside paddingTop). */}
          <View style={styles.titleRow}>
            <Txt
              typography="t5"
              fontWeight="bold"
              color={SdsColors.grey900}
              numberOfLines={1}
            >
              {tab?.label ?? ''}
            </Txt>
            <Txt
              typography="t7"
              color={SdsColors.grey500}
              numberOfLines={1}
            >
              ({pending.length}/{maxSelection})
            </Txt>
          </View>
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
          on overflow. (Previously horizontal-scrolled but we moved off
          ScrollView during the formSheet scroll-bug investigation; the
          flexWrap design is kept since maxSelection is small and wrapping
          to a second row is cleaner than horizontal scroll for 2–3 items.) */}
      {pending.length > 0 && (
        <View style={[styles.chipsWrap, styles.chipsRow]}>
          {pending.map((id) => {
            const src = sourceById.get(id);
            if (!src) return null;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  logNoticesContentSelect({ content_type: 'picker_chip_remove', item_id: id });
                  handleToggle(id);
                }}
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
                  style={styles.chipText}
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

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = pending.includes(item.id);
          const atMax = pending.length >= maxSelection;
          if (!item.noticeAvailable) {
            return (
              <DeptRow
                name={item.name}
                selected={false}
                unsupported
                variant="checkbox"
                onPress={() => {
                  logNoticesContentSelect({
                    content_type: 'picker_unsupported',
                    item_id: item.id,
                  });
                  setUnsupportedTapped(item);
                }}
              />
            );
          }
          return (
            <DeptRow
              name={item.name}
              selected={isSelected}
              disabled={atMax && !isSelected}
              variant="checkbox"
              onPress={() => {
                logNoticesContentSelect({ content_type: 'picker_row', item_id: item.id });
                handleToggle(item.id);
              }}
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
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />

      <UnsupportedDeptSheet
        source={unsupportedTapped}
        umbrella={umbrella}
        onAccept={(alt) => {
          // In the picker, "그렇게 할게요" adds the umbrella to the current
          // selection (add-only — never toggle-removes an already-picked one).
          if (!pending.includes(alt.id)) handleToggle(alt.id);
          setUnsupportedTapped(null);
        }}
        onDismiss={() => setUnsupportedTapped(null)}
      />
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
    // top/bottom are applied inline (insets.top + 8 / 10) so the absolute
    // box mirrors the header's content row, not the safe-area inset region.
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Single-row inline layout for title + counter — `학과 (1/3)` density
  // pack to save vertical space and keep the header compact.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
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
    // minWidth:0 releases RN's default content-driven minimum so the
    // chip respects its maxWidth even when an inner long Korean dept
    // name would otherwise force the pill wider than the row.
    minWidth: 0,
  },
  chipText: {
    // flexShrink:1 + minWidth:0 lets numberOfLines={1} actually truncate
    // (otherwise the Text's intrinsic width wins over parent's maxWidth
    // and the dept name overflows the pill / row).
    flexShrink: 1,
    minWidth: 0,
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
