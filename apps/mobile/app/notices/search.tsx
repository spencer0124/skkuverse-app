/**
 * Notices search — pushed when the accessory bar's search pill is tapped.
 *
 * ── Shape: ask, don't filter ──
 *
 *   ┌──────────────────────────────┐
 *   │ ‹                            │
 *   │                              │
 *   │            ●                 │
 *   │   공지, 무엇이든 물어보세요    │  idle: centered, composer is the CTA
 *   │   (신청 마감 언제야?)          │
 *   │                              │
 *   │  ┌────────────────────────┐  │
 *   │  │ 궁금한 걸 물어보세요     │  │
 *   │  │ (학과 ⌄)          [↑]  │  │
 *   │  └────────────────────────┘  │
 *   └──────────────────────────────┘
 *
 * The input lives at the bottom, above the keyboard, with the scope selector
 * in the slot a chat app gives its model picker. Everything above it is the
 * transcript: the answer, then the notices it was drawn from.
 *
 * ── No as-you-type list ──
 *
 * Earlier versions ran a 300ms-debounced lexical search and rebuilt the list on
 * every keystroke. That was the right shape for a filter and the wrong one for
 * a question: it fired a request per pause while someone typed a sentence, and
 * it trained people to type keywords, because keywords were the only thing that
 * produced visible movement. Results now appear only on submit, which is also
 * what makes the answer and the list arrive together instead of the list
 * flickering underneath a question that isn't finished.
 *
 * Why a separate route (vs. an inline TextInput in the UITabAccessory):
 * react-native-screens 4.19 does not wire keyboard avoidance for the iOS 26
 * UITabAccessory contentView (verified empirically on
 * feat/notices-search-prototype 2026-04-26). A normal RN screen sidesteps it.
 *
 * ── Scope ──
 *
 * Defaults to whatever the notices tab was showing — same resolvers
 * NoticesTabScreen uses, so a tab in "학과 picker" with [cs, sw] selected lands
 * here with sourceIds=['cs','sw']. No prop drilling, no nav params. The sheet
 * can re-aim it, including to 전체 (`resolveAllFollowedSourceIds`), because a
 * natural-language question is asked precisely when the user doesn't know
 * which tab holds the answer.
 */

import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { CaretLeftIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import {
  NOTICE_MULTI_SOURCE_LIMIT,
  SdsColors,
  resolveAllFollowedSourceIds,
  resolvePickerSelection,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { NoticeListPanel } from '@/features/notices/NoticeListPanel';
import { NoticeListSkeleton } from '@/features/notices/NoticeListSkeleton';
import { NoticeEmptyState } from '@/features/notices/EmptyState';
import { NoticeAnswerCard } from '@/features/notices/components/NoticeAnswerCard';
import { NoticesSearchIdleState } from '@/features/notices/components/NoticesSearchIdleState';
import { NoticesSearchComposer } from '@/features/notices/components/NoticesSearchComposer';
import {
  NoticesSearchScopeSheet,
  ALL_SCOPE_KEY,
} from '@/features/notices/components/NoticesSearchScopeSheet';
import { useNoticeAnswer } from '@/features/notices/hooks/useNoticeAnswer';
import { logNoticesContentSelect } from '@/services/analytics';
import { useNoticesUiStore } from '@/features/notices/store/noticesUiStore';
import { useNoticesSearchPlaceholder } from '@/features/notices/hooks/useNoticesSearchPlaceholder';

type NoticesSearchScope = 'tab' | 'all';

const KOREAN_SYLLABLE_START = 0xac00;
const KOREAN_SYLLABLE_END = 0xd7a3;
const MIN_LATIN_LEN = 2;

// Korean is informationally dense per syllable — 1 char already narrows
// usefully. Latin needs 2 chars or the result set explodes. Whitespace-only is
// treated as empty.
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
  const placeholder = useNoticesSearchPlaceholder();

  const [query, setQuery] = useState('');
  /** The committed question. Null until the user sends something. */
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [dismissedAnswerFor, setDismissedAnswerFor] = useState<string | null>(
    null,
  );
  const [scopeOverride, setScopeOverride] =
    useState<NoticesSearchScope | null>(null);
  const [scopeTabKey, setScopeTabKey] = useState<string | null>(null);
  const scopeSheetRef = useRef<BottomSheetModal>(null);
  const inputRef = useRef<TextInput>(null);

  // Scope mirror: read the same active tab + picker state the notices tab is
  // currently bound to.
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );
  const { data: tabsConfig, isLoading: isTabsLoading } = useNoticeTabs();

  const effectiveTabKey = scopeTabKey ?? activeTabKey;

  // Falls back to the first tab so the chip always has a label. On a cold start
  // (deep link, notices tab never visited) `activeTabKey` is empty, and without
  // the fallback the chip would render nothing and the scope sheet would be
  // unreachable.
  const scopeTab = useMemo(() => {
    const tabs = tabsConfig?.tabs ?? [];
    return tabs.find((tab) => tab.key === effectiveTabKey) ?? tabs[0];
  }, [tabsConfig, effectiveTabKey]);

  const tabSourceIds = useMemo<string[]>(() => {
    if (!scopeTab) return [];
    if (scopeTab.tabMode === 'picker' && scopeTab.picker) {
      return resolvePickerSelection(scopeTab, pickerSelections[scopeTab.key]);
    }
    if (scopeTab.tabMode === 'fixed' && scopeTab.fixed) {
      return [scopeTab.fixed.sourceId];
    }
    return [];
  }, [scopeTab, pickerSelections]);

  const allSourceIds = useMemo(
    () => resolveAllFollowedSourceIds(tabsConfig?.tabs ?? [], pickerSelections),
    [tabsConfig, pickerSelections],
  );

  // `GET /notices` caps sourceIds at NOTICE_MULTI_SOURCE_LIMIT and 400s past
  // it. Today's tab config lands exactly on that ceiling, so one added notice
  // tab would make every 전체 search fail — check rather than assume, and drop
  // the option instead of shipping a control that errors.
  const canSearchAll =
    allSourceIds.length > 0 && allSourceIds.length <= NOTICE_MULTI_SOURCE_LIMIT;

  // Cold start has no tab to inherit and `scopeTab` has fallen back to the
  // first one; searching an arbitrary department by default would be worse than
  // searching everything, so 전체 wins until the user aims it.
  const scope: NoticesSearchScope =
    scopeOverride ?? (activeTabKey ? 'tab' : 'all');
  const effectiveScope: NoticesSearchScope =
    scope === 'all' && !canSearchAll ? 'tab' : scope;
  const sourceIds = effectiveScope === 'all' ? allSourceIds : tabSourceIds;
  const scopeLabel =
    effectiveScope === 'all'
      ? t('notices.search.scope.all')
      : (scopeTab?.label ?? '');

  // The answer belongs to the question as sent. `dismissedAnswerFor` keeps a
  // dismissal scoped to that one question.
  const answerQuery =
    submittedQuery !== null && submittedQuery !== dismissedAnswerFor
      ? submittedQuery
      : undefined;
  const answer = useNoticeAnswer({ query: answerQuery, sourceIds });

  const canSubmit = isMinLengthMet(query);

  const commitQuery = useCallback(
    (raw: string, contentType: 'search_submit' | 'search_suggestion') => {
      const trimmed = raw.trim();
      if (!isMinLengthMet(trimmed)) return;
      // Clear the composer like a chat input does. The question does not
      // disappear — it is echoed above the answer, which is now the only place
      // it is visible since the field moved to the bottom.
      setQuery('');
      setSubmittedQuery(trimmed);
      setDismissedAnswerFor(null);
      Keyboard.dismiss();
      // Query text is deliberately not sent — scope and length are enough to
      // tell whether people ask questions here or type keywords.
      logNoticesContentSelect({
        content_type: contentType,
        item_id: `${effectiveScope}:${trimmed.length}`,
      });
    },
    [effectiveScope],
  );

  const handleScopeChange = useCallback((next: NoticesSearchScope) => {
    setScopeOverride(next);
    // The answer was grounded in the old scope; retract it rather than let a
    // stale answer sit above freshly re-scoped results.
    setSubmittedQuery(null);
  }, []);

  // One handler for both kinds of row — 전체 and the nine tabs live in the same
  // list, so the scope switch and the tab switch are the same gesture.
  const handleSelectScope = useCallback(
    (key: string) => {
      logNoticesContentSelect({ content_type: 'search_scope_tab', item_id: key });
      if (key === ALL_SCOPE_KEY) {
        handleScopeChange('all');
      } else {
        setScopeTabKey(key);
        handleScopeChange('tab');
      }
      scopeSheetRef.current?.dismiss();
    },
    [handleScopeChange],
  );

  // Only worth offering when 전체 would actually reach further than this tab.
  const searchEmptyAction = useMemo(() => {
    if (effectiveScope !== 'tab' || !canSearchAll) return undefined;
    if (allSourceIds.length <= tabSourceIds.length) return undefined;
    return {
      label: t('notices.search.expandToAll'),
      onPress: () => {
        logNoticesContentSelect({
          content_type: 'search_expand_all',
          item_id: activeTabKey || 'unknown',
        });
        handleScopeChange('all');
      },
    };
  }, [
    effectiveScope,
    canSearchAll,
    allSourceIds.length,
    tabSourceIds.length,
    t,
    activeTabKey,
    handleScopeChange,
  ]);

  const answerSlot =
    answer.status === 'unavailable' ? undefined : (
      <NoticeAnswerCard
        state={answer}
        onCitationPress={(citation) => {
          logNoticesContentSelect({
            content_type: 'answer_citation',
            item_id: `${citation.sourceId}/${citation.articleNo}`,
          });
          router.push(
            `/notices/${citation.sourceId}/${citation.articleNo}` as never,
          );
        }}
        onFollowUpPress={(question) => {
          logNoticesContentSelect({
            content_type: 'answer_followup',
            item_id: `${question.length}`,
          });
          commitQuery(question, 'search_submit');
        }}
        onDismiss={() => {
          logNoticesContentSelect({
            content_type: 'answer_dismiss',
            item_id: effectiveScope,
          });
          setDismissedAnswerFor(submittedQuery);
        }}
      />
    );

  // The question echo is separate from `answerSlot` on purpose: the answer
  // layer is `unavailable` until the backend ships, and the user still has to
  // be able to see what they asked.
  const headerSlot = submittedQuery ? (
    <>
      <View style={styles.questionEcho}>
        <Txt typography="t5" fontWeight="semibold" color={SdsColors.grey900}>
          {submittedQuery}
        </Txt>
      </View>
      {answerSlot}
    </>
  ) : undefined;

  const listProps = {
    q: submittedQuery ?? undefined,
    answerSlot: headerSlot,
    searchEmptyAction,
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={() => {
            logNoticesContentSelect({ content_type: 'search_back', item_id: 'back' });
            router.back();
          }}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <CaretLeftIcon size={26} color={SdsColors.grey900} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {submittedQuery === null ? (
          <NoticesSearchIdleState
            onPickQuery={(q) => commitQuery(q, 'search_suggestion')}
          />
        ) : isTabsLoading ? (
          <NoticeListSkeleton />
        ) : sourceIds.length === 0 ? (
          <NoticeEmptyState
            message={t('notices.empty')}
            onRetry={() => router.back()}
          />
        ) : sourceIds.length === 1 ? (
          <NoticeListPanel sourceId={sourceIds[0]} {...listProps} />
        ) : (
          <NoticeListPanel sourceIds={sourceIds} {...listProps} />
        )}
      </View>

      <NoticesSearchComposer
        ref={inputRef}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        scopeLabel={scopeLabel}
        onScopePress={() => scopeSheetRef.current?.present()}
        onSubmit={() => commitQuery(query, 'search_submit')}
        canSubmit={canSubmit}
      />

      <NoticesSearchScopeSheet
        ref={scopeSheetRef}
        tabs={tabsConfig?.tabs ?? []}
        selectedKey={effectiveScope === 'all' ? ALL_SCOPE_KEY : effectiveTabKey}
        pickerSelections={pickerSelections}
        onSelect={handleSelectScope}
        canSelectAll={canSearchAll}
      />
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
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  questionEcho: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
