import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Share, View, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BookmarkIcon, BookmarkSimpleIcon, ShareNetworkIcon } from 'phosphor-react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  SdsColors,
  useNoticeDetail,
  useT,
} from '@skkuverse/shared';
import type { NoticeAttachment } from '@skkuverse/shared';
import { Toast, Txt } from '@skkuverse/sds';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { InlineBanner } from '@/features/ads/InlineBanner';
import { AdUnitIds } from '@/utils/ad-helper';
import {
  logNoticeView,
  logNoticesContentSelect,
} from '@/services/analytics';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { THREE_DAYS_MS } from '@/features/feedback/useReviewPromptGate';
import { useBookmark } from './hooks/useBookmark';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { SummaryCard } from './SummaryCard';
import { DeletedNoticeTombstone } from './DeletedNoticeTombstone';
// import { NoticeReactions } from './components/NoticeReactions';  // 백엔드 미구현 — 아래 JSX와 함께 복구
import { NoticeAttachments } from './components/NoticeAttachments';
import { NoticeContentRefs } from './components/NoticeContentRefs';
import { NoticeBodyDivider } from './components/NoticeBodyDivider';
import { NoticeSiblingNav } from './components/NoticeSiblingNav';
import { NoticeSourceSheet } from './components/NoticeSourceSheet';
import { extractContentRefs } from './utils/extractContentRefs';
import { buildAttachmentUrl, canPreview } from './utils/attachment';
import { formatDisplayDate } from './utils/formatDisplayDate';

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

  // 본문에서 포스터·신청 링크·문의처를 뽑아 요약 영역으로 끌어올린다.
  // 첨부파일 URL은 제외 — 바로 아래 첨부 목록에 이미 있다.
  const contentRefs = useMemo(
    () =>
      extractContentRefs(
        data?.contentMarkdown,
        data?.attachments.map((a) => a.url) ?? [],
      ),
    [data?.contentMarkdown, data?.attachments],
  );

  // 공지 본문(GFM)은 더 이상 상세 화면 인라인이 아니라 이 시트 안에 산다.
  const sourceSheetRef = useRef<BottomSheetModal>(null);
  const openSourceSheet = useCallback(() => {
    const current = dataRef.current;
    if (current) {
      logNoticesContentSelect({
        content_type: 'detail_view_source',
        item_id: `${current.sourceId}/${current.articleNo}`,
      });
    }
    sourceSheetRef.current?.present();
  }, []);

  const closeSourceSheet = useCallback(() => {
    sourceSheetRef.current?.dismiss();
  }, []);

  // 인앱 webview 셸이 아니라 외부 브라우저로 연다. 이 액션의 진입점이
  // 본문 시트 안으로 옮겨졌는데, 시트 위에서 router.push를 하면 새 화면이
  // 시트 **뒤로** 들어가 아무 일도 안 일어난 것처럼 보인다.
  const openOriginal = useCallback(() => {
    if (!data?.sourceUrl) return;
    void Linking.openURL(data.sourceUrl);
  }, [data?.sourceUrl]);

  const openAttachment = useCallback(
    (url: string, mode: 'inline' | 'download', name?: string) => {
      const proxyUrl = buildAttachmentUrl(url, data?.sourceUrl ?? '', mode, name);
      void WebBrowser.openBrowserAsync(proxyUrl, inAppBrowserOptions);
    },
    [data?.sourceUrl],
  );

  const handleAttachmentPreview = useCallback(
    (a: NoticeAttachment) => {
      const previewable = canPreview(a.name);
      logNoticesContentSelect({
        content_type: previewable
          ? 'detail_attachment_preview'
          : 'detail_attachment_download',
        item_id: a.name,
      });
      // hwp/doc/zip 등은 인앱 브라우저가 못 그린다. 예전엔 "미리보기를 지원하지
      // 않아요" 토스트를 띄우고 사용자가 다운로드 버튼을 다시 누르게 했는데,
      // 그건 앱이 이미 아는 사실을 사용자에게 되묻는 것이다 — 곧장 다운로드로
      // 보낸다.
      openAttachment(a.url, previewable ? 'inline' : 'download', a.name);
    },
    [openAttachment],
  );

  const handleCopyContact = useCallback(
    (value: string) => {
      void Clipboard.setStringAsync(value);
      setToastText(t('notices.copied'));
    },
    [t],
  );

  const handleAttachmentDownload = useCallback(
    (a: NoticeAttachment) => {
      logNoticesContentSelect({
        content_type: 'detail_attachment_download',
        item_id: a.name,
      });
      openAttachment(a.url, 'download', a.name);
    },
    [openAttachment],
  );

  const handleOpenOriginalPress = useCallback(() => {
    const current = dataRef.current;
    if (current) {
      logNoticesContentSelect({
        content_type: 'detail_open_original',
        item_id: `${current.sourceId}/${current.articleNo}`,
      });
    }
    openOriginal();
  }, [openOriginal]);

  // 주소 복사는 제거됨 — 헤더 공유 버튼(handleSharePress)이 같은 URL을
  // 이미 내보내고 있어 역할이 겹쳤다.

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

        {/* 본문에서 뽑은 포스터·링크·연락처 */}
        <NoticeContentRefs
          images={contentRefs.images}
          links={contentRefs.links}
          emails={contentRefs.emails}
          phones={contentRefs.phones}
          sourceUrl={data.sourceUrl}
          onImagePress={openSourceSheet}
          onCopyContact={handleCopyContact}
        />

        <NoticeAttachments
          attachments={data.attachments}
          sourceUrl={data.sourceUrl}
          onPreview={handleAttachmentPreview}
          onDownload={handleAttachmentDownload}
        />

        {/* 요약 끝 / 전문 시작 경계 겸 시트 진입점. 면을 가진 버튼이라
            아래 블록들과 바로 붙여도 경계가 선다. */}
        {data.contentMarkdown ? (
          <NoticeBodyDivider onPress={openSourceSheet} />
        ) : (
          <View style={styles.sectionBreak} />
        )}

        {/* 이모지 반응 — 백엔드(집계·투표 저장) 미구현이라 비노출.
            컴포넌트(`components/NoticeReactions.tsx`)와 i18n 키는 그대로
            살아 있으니 이 한 줄만 되살리면 복구된다. mock 수치는
            articleNo 해시 기반이라 서버 연동 시 그 부분만 교체하면 된다.
        <NoticeReactions articleNo={articleNo} />
        */}

        {/* ── 콘텐츠 종료. 광고는 이 경계 **뒤**, 아래 네비게이션 **앞**에
            둔다. 맨 끝에 두면 사용자가 안 보고 나가고, 중간에 두면 읽는 흐름을
            끊는다. "콘텐츠는 끝났지만 아직 갈 곳이 남은" 이 자리가 유일한
            절충점 — 다음글로 가려면 반드시 지나간다.
            슬롯 예약(maxHeight)은 필수: 아래에 누를 것이 있는데 광고가 늦게
            로드되며 밀면 그게 곧 오클릭이다. ── */}
        <InlineBanner unitId={AdUnitIds.noticeDetailBanner} maxHeight={250} />

        {/* 원문/원본 액션은 시트 헤더로 옮겼다 — 여기 두면 이전글/다음글과
            나란히 서서 "다른 글로 가는 것"처럼 읽힌다. */}
        <NoticeSiblingNav sourceId={sourceId} articleNo={articleNo} />
        </ScrollView>
      )}
      {/* [on-device LLM 비활성화 — 공지 'AI에게 질문하기' 진입 바 + 시트 삭제. 추후 복구 시 git 이력 참조] */}
      {/* ScrollView 바깥 — 시트는 화면 전체를 덮으므로 콘텐츠 트리와 분리한다.
          `data`가 없는 분기(로딩/에러/툼스톤)에선 트리거 버튼도 없으니
          markdown을 null로 넘겨도 present()될 일이 없다. */}
      <NoticeSourceSheet
        ref={sourceSheetRef}
        markdown={data?.contentMarkdown ?? null}
        sourceUrl={data?.sourceUrl}
        onCopyText={handleCopyText}
        onOpenOriginal={handleOpenOriginalPress}
        onClose={closeSourceSheet}
      />
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

// canPreview / buildAttachmentUrl은 `./utils/attachment`로 이동했다 —
// NoticeAttachments가 썸네일 URL을 만들려면 화면 바깥에 있어야 한다.

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
    paddingBottom: 32,
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
  /* ── 리듬 ──
   * 이 화면의 간격 체계는 세 단계뿐이다:
   *   블록 내부 = 8 (scroll의 gap)
   *   블록 사이 = 각 컴포넌트가 지는 marginTop 14~24
   *   섹션 사이 = sectionBreak (28 + hairline)
   * 테두리는 "누를 수 있는 것"에만 남긴다 — 첨부 행, 액션 리스트, 반응 pill.
   * 읽기만 하는 것(본문·타임라인·속성표)은 여백으로만 나눈다. */
  // 마크다운 본문이 없어 '자세히 보기' 버튼을 못 그리는 공지에서만 쓰인다.
  // 버튼이 있을 땐 그 면이 경계 역할을 겸하므로 선을 그리지 않는다.
  sectionBreak: {
    marginTop: 24,
    marginBottom: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey200,
  },
  pressed: {
    opacity: 0.6,
  },
});

