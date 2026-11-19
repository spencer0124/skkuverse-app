import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useT } from '@skkuverse/shared';
import { useSemanticColors, type SheetRef } from '@skkuverse/sds';
import { logNoticeView, logNoticesContentSelect } from '@/platform/analytics';
import { isPageReturn } from '@/platform/analytics.rules';
import { openExternalUrl, openInAppBrowser, shareContent } from '@/platform/handoff';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { THREE_DAYS_MS } from '@/features/feedback/feedback.constants';
import { useBookmark } from './useBookmark';
import { useNoticeDetail } from './useNoticeDetail';
import { useNoticeTabs } from './useNoticeTabs';
import { toSourceName } from './notices.rules';
import { extractContentRefs } from './content-refs.rules';
import { buildAttachmentUrl, canPreview } from './attachment.rules';
import { decideNoticeDetailState } from './notice-detail.rules';
import { toFullBodyMarkdown, toNoticeBrief } from './notice-brief.rules';
import type { NoticeBriefAttachment, NoticeBriefLink } from './notice-brief.types';
import { dummyNoticeBrief } from './notices.client';

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

interface UseNoticeDetailScreenInputs {
  sourceId: string;
  articleNo: number;
  /** WHY: a notice pushed back by closing a place it opened is the same visit, so it logs no second view. */
  source: string | undefined;
  reviewIcon: ReactNode;
}

export function useNoticeDetailScreen({ sourceId, articleNo, source, reviewIcon }: UseNoticeDetailScreenInputs) {
  const { t } = useT();
  const color = useSemanticColors();
  const router = useRouter();
  const dummy = useMemo(() => dummyNoticeBrief(sourceId, articleNo), [sourceId, articleNo]);
  const { data, isLoading, isError, error, refetch } = useNoticeDetail(
    dummy ? null : sourceId,
    dummy ? null : articleNo,
  );
  const { data: tabsConfig } = useNoticeTabs();
  const [toastText, setToastText] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const review = useReviewPrompt({
    reason: 'second_bookmark',
    minInstallAgeMs: THREE_DAYS_MS,
    title: t('feedback.reviewPrompt.bookmarkTitle'),
    icon: reviewIcon,
    resolveContext: () => ({ sourceId, articleNo }),
  });

  const {
    isSaved: saved,
    entry: bookmarkEntry,
    toggle: toggleBookmark,
    unsave: unsaveBookmark,
    refreshSummaryIfNewlyAvailable,
  } = useBookmark(sourceId, articleNo, {
    onReviewEligible: review.triggerIfEligible,
  });

  const boardName = data ? (toSourceName(tabsConfig, data.sourceId) ?? data.department) : null;

  const onRemoveBookmark = useCallback(() => {
    setIsRemoving(true);
    void unsaveBookmark().then((outcome) => {
      setIsRemoving(false);
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

  // WHY: heals a bookmark saved before the server summarized the notice; a no-op otherwise.
  useEffect(() => {
    if (data) void refreshSummaryIfNewlyAvailable(data);
  }, [data, refreshSummaryIfNewlyAvailable]);

  // WHY: keyed on (id, summary type), so a background refetch does not log a second view.
  useEffect(() => {
    if (!data || isPageReturn(source)) return;
    logNoticeView({
      sourceId,
      articleNo,
      hasSummary: data.summary != null,
      hasScreen: false,
      summaryType: data.summary?.type,
    });
  }, [sourceId, articleNo, data?.summary?.type]); // eslint-disable-line react-hooks/exhaustive-deps -- one view per notice and summary type, not per refetch (comment above)

  // QUIRK(ios): a new `data` reference would rebuild the header options, and react-native-screens
  // re-applying the bar items is the window in which UIBarButtonItem flashes its title. Read at call time.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const onCopy = useCallback((text: string) => {
    void Clipboard.setStringAsync(text);
    setToastText(t('notices.copied'));
  }, [t]);

  const contentRefs = useMemo(
    () =>
      extractContentRefs(
        data?.contentMarkdown,
        data?.attachments.map((a) => a.url) ?? [],
      ),
    [data?.contentMarkdown, data?.attachments],
  );

  const brief = useMemo(
    () =>
      dummy ??
      (data
        ? toNoticeBrief({
            notice: data,
            boardName,
            refs: contentRefs,
            question: t('notices.brief.defaultQuestion'),
            label: t('notices.brief.label'),
          })
        : undefined),
    [dummy, data, boardName, contentRefs, t],
  );
  const state = decideNoticeDetailState({ isLoading, isError, error, data: brief, bookmark: bookmarkEntry });
  const fullBody = useMemo(() => (brief ? toFullBodyMarkdown(brief.body) : null), [brief]);
  const itemId = `${sourceId}/${articleNo}`;

  const sourceSheetRef = useRef<SheetRef>(null);
  const openSourceSheet = useCallback(() => {
    logNoticesContentSelect({ content_type: 'detail_view_source', item_id: itemId });
    sourceSheetRef.current?.present?.();
  }, [itemId]);

  const closeSourceSheet = useCallback(() => {
    sourceSheetRef.current?.dismiss?.();
  }, []);

  // WHY: the external browser, not the in-app shell: this opens from inside the source sheet, and a
  // router.push from there lands behind the sheet, so nothing seems to happen.
  const sourceUrl = brief?.source.url;
  const openOriginal = useCallback(() => {
    logNoticesContentSelect({ content_type: 'detail_open_original', item_id: itemId });
    if (!sourceUrl) return;
    void openExternalUrl(sourceUrl);
  }, [sourceUrl, itemId]);

  const openAttachment = useCallback(
    (url: string, mode: 'inline' | 'download', name?: string) => {
      const proxyUrl = buildAttachmentUrl(url, sourceUrl ?? '', mode, name);
      void openInAppBrowser(proxyUrl, {
        ...inAppBrowserOptions,
        controlsColor: color.fg.brand,
        toolbarColor: color.bg.layerDefault,
      });
    },
    [sourceUrl, color],
  );

  const onSourcePress = useCallback(() => {
    logNoticesContentSelect({ content_type: 'detail_open_original', item_id: itemId });
    if (!sourceUrl) return;
    void openInAppBrowser(sourceUrl, {
      ...inAppBrowserOptions,
      controlsColor: color.fg.brand,
      toolbarColor: color.bg.layerDefault,
    });
  }, [sourceUrl, itemId, color]);

  const onAttachmentPress = useCallback(
    (a: NoticeBriefAttachment) => {
      const previewable = canPreview(a.name);
      logNoticesContentSelect({
        content_type: previewable
          ? 'detail_attachment_preview'
          : 'detail_attachment_download',
        item_id: a.name,
      });
      // WHY: the in-app browser cannot draw hwp, doc or zip, so those go straight to download.
      openAttachment(a.url, previewable ? 'inline' : 'download', a.name);
    },
    [openAttachment],
  );

  const onLinkPress = useCallback((link: NoticeBriefLink) => {
    void openExternalUrl(link.url);
  }, []);

  const onPhonePress = useCallback((phone: string) => {
    void openExternalUrl(`tel:${phone.replace(/[^\d+]/g, '')}`);
  }, []);

  const onEmailPress = useCallback((email: string) => {
    void openExternalUrl(`mailto:${email}`);
  }, []);

  const onAnswerInfo = useCallback(() => setToastText(t('notices.brief.answerInfo')), [t]);

  const onSave = useCallback(() => {
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

  const onShare = useCallback(() => {
    const current = dataRef.current;
    if (!current) return;
    logNoticesContentSelect({
      content_type: 'detail_share',
      item_id: `${current.sourceId}/${current.articleNo}`,
    });
    // QUIRK(ios): the share sheet appends `url` to a Messages text itself, so `message` carries only the title.
    // QUIRK(android): ACTION_SEND ignores `url`, so the URL goes inside `message`.
    const noticeUrl = `https://skkuverse.com/p/notices/${current.sourceId}/${current.articleNo}`;
    void shareContent(
      Platform.OS === 'ios'
        ? { url: noticeUrl, message: current.title }
        : { message: `${current.title}\n${noticeUrl}` },
    );
  }, []);

  return {
    ...state,
    saved,
    isRemoving,
    fullBody,
    sourceUrl,
    sourceSheetRef,
    toastText,
    reviewHost: review.host,
    onRetry: refetch,
    onRemoveBookmark,
    onSave,
    onShare,
    onCopy,
    openSourceSheet,
    closeSourceSheet,
    openOriginal,
    onSourcePress,
    onAttachmentPress,
    onLinkPress,
    onPhonePress,
    onEmailPress,
    onAnswerInfo,
    onToastClose: () => setToastText(null),
  };
}
