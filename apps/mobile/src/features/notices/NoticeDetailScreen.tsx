import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { BookmarkIcon, BookmarkSimpleIcon, DownloadIcon, EyeIcon, ArrowSquareOutIcon, PaperclipIcon, ShareNetworkIcon } from 'phosphor-react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  SdsColors,
  useNoticeDetail,
  useT,
} from '@skkuverse/shared';
import { Toast, Txt } from '@skkuverse/sds';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import {
  logNoticeView,
  logNoticesContentSelect,
} from '@/services/analytics';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { THREE_DAYS_MS } from '@/features/feedback/useReviewPromptGate';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useBookmark } from './hooks/useBookmark';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { SummaryCard } from './SummaryCard';
import { NoticeMarkdownView } from './NoticeMarkdownView';
import { DeletedNoticeTombstone } from './DeletedNoticeTombstone';
import { formatDisplayDate } from './utils/formatDisplayDate';
import { NoticeAiBar } from './ai/NoticeAiBar';
import { NoticeAiSheet } from './ai/NoticeAiSheet';

const ICON_BOOKMARK = require('../../../assets/header-icons/bookmark-simple.png');
const ICON_BOOKMARK_FILL = require('../../../assets/header-icons/bookmark-simple-fill.png');
const ICON_SHARE = require('../../../assets/header-icons/share-network.png');

interface Props {
  sourceId: string;
  articleNo: number;
}

export function NoticeDetailScreen({ sourceId, articleNo }: Props) {
  const { t, tpl } = useT();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useNoticeDetail(sourceId, articleNo);
  const [toastText, setToastText] = useState<string | null>(null);
  const [isUnsaving, setIsUnsaving] = useState(false);

  // SKKU AI 질문 시트 — 정상 본문 분기에서만 노출 (삭제/에러/로딩 제외).
  const aiSheetRef = useRef<BottomSheetModal>(null);
  const openAiSheet = useCallback(() => aiSheetRef.current?.present(), []);

  // Review-prompt funnel — orchestrated by the common useReviewPrompt hook.
  // Handles stage-1 sheet, native StoreReview, stage-2 feedback, thanks dialog,
  // analytics, and engagement-store updates. We pass a resolveContext fn so the
  // feedback document can carry the notice reference for server-side attribution.
  const review = useReviewPrompt({
    reason: 'second_bookmark',
    minInstallAgeMs: THREE_DAYS_MS,
    title: t('feedback.reviewPrompt.bookmarkTitle'),
    icon: <BookmarkSimpleIcon size={32} color="#1f3d2e" weight="fill" />,
    resolveContext: () => ({ sourceId, articleNo }),
  });

  // Real bookmark state — synced via Firestore listener in useAppInit. The
  // optimistic toggle policy lives inside `useBookmark` (revert only on
  // permanent error). UX outcome handling stays here.
  const {
    isSaved: saved,
    entry: bookmarkEntry,
    toggle: toggleBookmark,
    unsave: unsaveBookmark,
    refreshSummaryIfNewlyAvailable,
  } = useBookmark(sourceId, articleNo, {
    onReviewEligible: review.triggerIfEligible,
  });

  // Tombstone gating: server returned 404 (notice deleted server-side per
  // crawler 3-strikes + isDeleted flag) AND we have a cached BookmarkEntry
  // for it. Non-bookmark 404s keep the simple error+retry path — that's
  // the server team's documented decision (notices-api-architecture.md
  // §3.15) and we honor it for non-saved traffic. The tombstone is scoped
  // exclusively to the population that actually has expectations of finding
  // the content.
  const isDeletedBookmark =
    isError &&
    error?.type === 'server' &&
    error.statusCode === 404 &&
    bookmarkEntry !== null;

  const handleRemoveDeletedBookmark = useCallback(() => {
    setIsUnsaving(true);
    void unsaveBookmark().then((outcome) => {
      setIsUnsaving(false);
      if (outcome === 'removed') {
        router.back();
      } else if (outcome === 'auth-required') {
        setToastText(t('notices.authRequired'));
        router.push('/login');
      } else {
        setToastText(t('notices.saveFailed'));
      }
    });
  }, [unsaveBookmark, router, t]);

  // Opportunistic summary refresh — heals bookmarks saved before the server
  // had summarized the notice. Internal early-returns mean this is a no-op
  // for: not-bookmarked, summary already cached, summary still null
  // server-side, or an in-flight write from a prior refetch tick. See
  // useBookmark.ts JSDoc on refreshSummaryIfNewlyAvailable for full rules.
  useEffect(() => {
    if (data) void refreshSummaryIfNewlyAvailable(data);
  }, [data, refreshSummaryIfNewlyAvailable]);

  // Notice-detail view event. Mirrors logBuildingView's "fire once per
  // unique key" pattern. Dep narrowed to (id, summary.type) so React Query
  // background refetches with structural-sharing breaks don't re-emit
  // unless the server newly populated/changed the AI summary classification.
  useEffect(() => {
    if (!data) return;
    logNoticeView({
      sourceId,
      articleNo,
      hasSummary: data.summary != null,
      summaryType: data.summary?.type,
    });
  }, [sourceId, articleNo, data?.summary?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Latest `data` is captured in a ref so header callbacks can stay stable
  // across React Query background refetches (focusManager refetch on app
  // resume, structural-sharing breakdown on JSON shape drift). Without this,
  // each new `data` reference would invalidate `handleSavePress` /
  // `handleSharePress` → `headerOptions` `useMemo` → react-native-screens
  // re-applies native bar items, which is the very transition window in
  // which iOS UIBarButtonItem briefly leaks its `title` text. Refs are
  // intentionally read at call-time, not closed over at definition-time.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const handleCopyText = useCallback((text: string) => {
    void Clipboard.setStringAsync(text);
    setToastText(t('notices.copied'));
  }, [t]);

  const openOriginal = useCallback(() => {
    if (!data?.sourceUrl) return;
    void WebBrowser.openBrowserAsync(data.sourceUrl, inAppBrowserOptions);
  }, [data?.sourceUrl]);

  const openAttachment = useCallback(
    (url: string, mode: 'inline' | 'download', name?: string) => {
      const proxyUrl = buildAttachmentUrl(url, data?.sourceUrl ?? '', mode, name);
      void WebBrowser.openBrowserAsync(proxyUrl, inAppBrowserOptions);
    },
    [data?.sourceUrl],
  );

  const handleSavePress = useCallback(() => {
    const current = dataRef.current;
    if (!current) return;
    void toggleBookmark(current).then((outcome) => {
      if (outcome === 'auth-required') {
        setToastText(t('notices.authRequired'));
        router.push('/login');
      } else if (outcome === 'failed') {
        setToastText(t('notices.saveFailed'));
      }
    });
  }, [toggleBookmark, t, router]);

  const handleSharePress = useCallback(() => {
    const current = dataRef.current;
    if (!current) return;
    logNoticesContentSelect({
      content_type: 'detail_share',
      item_id: `${current.sourceId}/${current.articleNo}`,
    });
    // Universal link: app-installed devices open detail screen directly
    // (AASA + +native-intent NOTICE_PATH_RE), app-missing devices fall
    // through to the Cloudflare Pages Function at the same path which
    // renders an unfurl-friendly notice page (og:title/description/image
    // meta tags present so iOS Messages renders a rich link card).
    //   iOS  → pass `url` only + `message` = title. iOS auto-appends `url`
    //          to Messages text, so embedding the URL in `message` would
    //          cause it to render twice. Title alone in `message` gives a
    //          graceful fallback if rich-link OG fetch fails, and improves
    //          Mail subject + Copy paste UX.
    //   Android → ACTION_SEND chooser ignores `url`, so embed the URL in
    //          `message` to keep parity.
    const noticeUrl = `https://skkuverse.com/p/notices/${current.sourceId}/${current.articleNo}`;
    void Share.share(
      Platform.OS === 'ios'
        ? { url: noticeUrl, message: current.title }
        : { message: `${current.title}\n${noticeUrl}` },
    );
  }, []);

  // Header right items — iOS uses native UIBarButtonItem so each gets its own
  // Liquid Glass capsule (`sharesBackground: false`); Android falls back to
  // JSX `headerRight` with `HeaderIconButton`. Same dispatch pattern as the
  // home tab's profile/settings icons (see app/(tabs)/home/index.tsx).
  //
  // Why stable `identifier` on iOS items (load-bearing for flicker fix):
  //   When `saved` flips, this `useMemo` returns a new options reference,
  //   `<Stack.Screen options>` re-applies, and react-native-screens does
  //   `navitem.rightBarButtonItems = [...]` (RNSScreenStackHeaderConfig.mm).
  //   `setRightBarButtonItems:` replaces the entire array. Without stable
  //   identifiers, iOS 26 has no way to match old items to new items, so
  //   it animates BOTH capsules out and BOTH back in — even share, whose
  //   icon never changed. With `identifier: 'bookmark'` / `'share'`, iOS 26
  //   matches items across the assignment (UIBarButtonItem.identifier was
  //   introduced for this exact case) and animates only the changed
  //   properties (image, accessibilityLabel) in place. RNSBarButtonItem.mm
  //   already plumbs the field through (`@available(iOS 26.0, *)` guarded);
  //   on iOS < 26 the property is silently ignored — no regression.
  //
  // Why `label: ''` on iOS items (different from home tab which sets text):
  //   `label` (required by SharedHeaderItem type) maps to UIBarButtonItem.title.
  //   With both `image` and a non-empty `title`, the iOS 26 Liquid Glass
  //   capsule briefly shows the title text during the layout transition
  //   that follows item creation/refresh before settling. The bookmark
  //   item refreshes on every `saved` flip (toggle-time) AND on the
  //   loading→success transition (mount-time) — both produced visible
  //   Korean text flashes ("저장" / "저장 취소"). Empty title → image-only
  //   layout, no text to flash. accessibilityLabel still provides VoiceOver
  //   announcement. Home tab does not refresh after first mount so users
  //   do not perceive the same flash there even with non-empty labels.
  //
  // Why `useMemo` + stable callbacks:
  //   `<Stack.Screen options={...}>` re-applies when the options object
  //   reference changes. Callbacks built from `useCallback([data, ...])`
  //   would invalidate on every React Query background refetch, churning
  //   the memo. The `dataRef` pattern above keeps `handleSavePress` /
  //   `handleSharePress` stable across refetches so the memo recomputes
  //   only on `saved` flip or language change. Note: memoization alone
  //   cannot prevent the toggle-time re-apply (saved MUST drive the icon
  //   image change) — that's why the `identifier` mechanism above is
  //   needed at the iOS layer, not in React.
  const headerOptions = useMemo<NativeStackNavigationOptions>(() => {
    // Tombstone state: hide bookmark + share. Bookmark icon would be filled
    // (saved) but tap → handleSavePress → toggleBookmark(dataRef.current)
    // early-returns on null data, so the button would be visibly broken.
    // Share is meaningless because the universal link 404s too.
    if (isDeletedBookmark) {
      return Platform.OS === 'ios'
        ? { title: '', unstable_headerRightItems: () => [] }
        : { title: '', headerRight: () => null };
    }
    return Platform.OS === 'ios'
      ? {
          title: '',
          unstable_headerRightItems: () => [
            {
              type: 'button' as const,
              identifier: 'bookmark',
              label: '',
              icon: {
                type: 'image' as const,
                source: saved ? ICON_BOOKMARK_FILL : ICON_BOOKMARK,
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: saved ? t('notices.unsave') : t('notices.save'),
              onPress: handleSavePress,
            },
            {
              type: 'button' as const,
              identifier: 'share',
              label: '',
              icon: { type: 'image' as const, source: ICON_SHARE, tinted: false },
              sharesBackground: false,
              accessibilityLabel: t('notices.share'),
              onPress: handleSharePress,
            },
          ],
        }
      : {
          title: '',
          headerRight: () => (
            <View style={styles.headerRight}>
              <HeaderIconButton
                onPress={handleSavePress}
                accessibilityLabel={saved ? t('notices.unsave') : t('notices.save')}
              >
                <BookmarkIcon
                  size={22}
                  color={saved ? SdsColors.blue500 : SdsColors.grey700}
                  weight={saved ? 'fill' : 'regular'}
                />
              </HeaderIconButton>
              <HeaderIconButton
                onPress={handleSharePress}
                accessibilityLabel={t('notices.share')}
              >
                <ShareNetworkIcon size={22} color={SdsColors.grey700} />
              </HeaderIconButton>
            </View>
          ),
        };
  }, [isDeletedBookmark, saved, t, handleSavePress, handleSharePress]);

  // Single Stack.Screen at a stable position — branching it across 3
  // returns (loading / error / success) risks register-then-unregister churn
  // even though React reconciles same-type at same-position. Keeping it
  // hoisted also makes the header guarantee independent of body state.
  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />
      {isLoading ? (
        <NoticeListSkeleton />
      ) : isDeletedBookmark && bookmarkEntry ? (
        // Server confirmed 404 (crawler 3-strikes, isDeleted: true) for a
        // notice the user previously saved. Render the cached fields plus
        // explicit "remove from saved" CTA. `bookmarkEntry` truth check is
        // redundant with `isDeletedBookmark` but satisfies TS narrowing.
        <DeletedNoticeTombstone
          entry={bookmarkEntry}
          onRemove={handleRemoveDeletedBookmark}
          isRemoving={isUnsaving}
        />
      ) : isError || !data ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
        <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
          {data.title}
        </Txt>

        <View style={styles.metaRow}>
          <Txt typography="t6" color={SdsColors.grey500}>
            {formatDisplayDate(data.date)}
          </Txt>
          {data.author ? (
            <>
              <Dot />
              <Txt typography="t6" color={SdsColors.grey500}>
                {data.author}
              </Txt>
            </>
          ) : null}
          {data.views > 0 ? (
            <>
              <Dot />
              <Txt typography="t6" color={SdsColors.grey500}>
                {tpl('notices.views', data.views)}
              </Txt>
            </>
          ) : null}
        </View>

        {data.summary ? (
          <SummaryCard
            summary={data.summary}
            sourceId={sourceId}
            articleNo={articleNo}
          />
        ) : null}

        <NoticeMarkdownView
          markdown={data.contentMarkdown}
          sourceUrl={data.sourceUrl}
          onCopyText={handleCopyText}
        />

        {data.attachments.length > 0 ? (
          <View style={styles.attachments}>
            <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
              {t('notices.attachments')}
            </Txt>
            {data.attachments.map((a) => (
              <View key={a.url} style={styles.attachmentItem}>
                <View style={styles.attachmentNameRow}>
                  <PaperclipIcon size={14} color={SdsColors.grey600} />
                  <Txt typography="t6" color={SdsColors.grey800} numberOfLines={1} style={styles.attachmentName}>
                    {a.name}
                  </Txt>
                </View>
                <View style={styles.attachmentActions}>
                  <Pressable
                    onPress={() => {
                      logNoticesContentSelect({
                        content_type: 'detail_attachment_preview',
                        item_id: a.name,
                      });
                      if (canPreview(a.name)) {
                        openAttachment(a.url, 'inline', a.name);
                      } else {
                        setToastText(t('notices.noPreview'));
                      }
                    }}
                    style={({ pressed }) => [styles.attachmentBtn, pressed && styles.pressed]}
                  >
                    <EyeIcon size={14} color={canPreview(a.name) ? SdsColors.blue500 : SdsColors.grey400} />
                    <Txt typography="t7" color={canPreview(a.name) ? SdsColors.blue500 : SdsColors.grey400}>
                      {t('notices.preview')}
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      logNoticesContentSelect({
                        content_type: 'detail_attachment_download',
                        item_id: a.name,
                      });
                      openAttachment(a.url, 'download', a.name);
                    }}
                    style={({ pressed }) => [styles.attachmentBtn, pressed && styles.pressed]}
                  >
                    <DownloadIcon size={14} color={SdsColors.blue500} />
                    <Txt typography="t7" color={SdsColors.blue500}>
                      {t('notices.download')}
                    </Txt>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            const current = dataRef.current;
            if (current) {
              logNoticesContentSelect({
                content_type: 'detail_open_original',
                item_id: `${current.sourceId}/${current.articleNo}`,
              });
            }
            openOriginal();
          }}
          style={({ pressed }) => [styles.openOriginal, pressed && styles.pressed]}
        >
          <ArrowSquareOutIcon size={16} color={SdsColors.grey800} />
          <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
            {t('notices.openOriginal')}
          </Txt>
        </Pressable>
        </ScrollView>
      )}
      {/* SKKU AI: 정상 본문에서만 하단 진입 바 + 질문 시트. 삭제/에러/로딩 분기 제외. */}
      {!isLoading && !isDeletedBookmark && !isError && data ? (
        <>
          <NoticeAiBar onPress={openAiSheet} />
          <NoticeAiSheet
            ref={aiSheetRef}
            notice={{
              title: data.title,
              contentMarkdown: data.contentMarkdown,
              summary: data.summary?.text,
            }}
          />
        </>
      ) : null}
      <Toast
        open={toastText !== null}
        text={toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={() => setToastText(null)}
      />
      {review.Host}
    </View>
  );
}

const NO_PREVIEW_EXTS = new Set(['.hwp', '.hwpx', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip']);

function canPreview(name: string): boolean {
  const ext = (name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
  return !NO_PREVIEW_EXTS.has(ext);
}

function buildAttachmentUrl(
  url: string,
  sourceUrl: string,
  mode: 'inline' | 'download',
  name?: string,
): string {
  const params = new URLSearchParams({ url, referer: sourceUrl, mode });
  if (name) params.set('name', name);
  return `https://files.skkuverse.com/notices/proxy/attachment?${params.toString()}`;
}

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  controlsColor: '#1A8A5C',
  toolbarColor: '#ffffff',
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

function Dot() {
  return <View style={styles.dot} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    // 하단 떠있는 'AI에게 질문하기' 바(52) + safe-area + 여백 확보.
    paddingBottom: 96,
    gap: 8,
  },
  title: {
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: SdsColors.grey400,
  },
  attachments: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: SdsColors.grey50,
    gap: 8,
  },
  attachmentItem: {
    gap: 6,
    paddingVertical: 6,
  },
  attachmentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentName: {
    flex: 1,
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 22,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openOriginal: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
  },
  pressed: {
    opacity: 0.6,
  },
});

