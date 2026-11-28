import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useT } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { logNoticeView, logNoticesContentSelect } from '@/platform/analytics';
import { isPageReturn } from '@/platform/analytics.rules';
import { openExternalUrl, openInAppBrowser, shareContent } from '@/platform/handoff';
import { openMapPlace } from '@/features/web/web.service';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { THREE_DAYS_MS } from '@/features/feedback/feedback.constants';
import { useBookmark } from './useBookmark';
import { useNoticeBrief } from './useNoticeBrief';
import { buildAttachmentUrl, canPreview } from './attachment.rules';
import { decideNoticeDetailState } from './notice-detail.rules';
import { toFullBodyMarkdown } from './notice-brief.rules';
import { toLinkHref, toMailtoHref, toTelHref } from './notice-refs.rules';
import type { NoticeBriefAttachment } from './notice-brief.types';
import type { NoticeRefLink } from './notice-refs.types';
import type { NoticeScheduleMapTarget } from './components/useNoticeScheduleSection';

export const noticeInAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
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
  const { data, isLoading, isError, error, refetch, brief } = useNoticeBrief(sourceId, articleNo);
  const [toastText, setToastText] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourceAfterDismiss = useRef(false);

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
  } = useBookmark(sourceId, articleNo, {
    onReviewEligible: review.triggerIfEligible,
  });

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

  // WHY: keyed on whether the notice has loaded, so a background refetch does not log a second view.
  const isLoaded = data !== undefined;
  useEffect(() => {
    if (!isLoaded || isPageReturn(source)) return;
    logNoticeView({ sourceId, articleNo });
  }, [isLoaded, source, sourceId, articleNo]);

  // QUIRK(ios): a new `data` reference would rebuild the header options, and react-native-screens
  // re-applying the bar items is the window in which UIBarButtonItem flashes its title. Read at call time.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const state = decideNoticeDetailState({ isLoading, isError, error, data: brief, bookmark: bookmarkEntry });
  const fullBody = useMemo(() => (brief ? toFullBodyMarkdown(brief.body) : null), [brief]);
  const itemId = `${sourceId}/${articleNo}`;

  const openFullBody = useCallback(() => {
    logNoticesContentSelect({ content_type: 'detail_view_source', item_id: itemId });
    router.push({
      pathname: '/notices/[sourceId]/[articleNo]/body',
      params: { sourceId, articleNo: String(articleNo) },
    });
  }, [itemId, router, sourceId, articleNo]);

  const sourceUrl = brief?.source.url;

  const openAttachment = useCallback(
    (url: string, mode: 'inline' | 'download', name?: string) => {
      const proxyUrl = buildAttachmentUrl(url, sourceUrl ?? '', mode, name);
      void openInAppBrowser(proxyUrl, {
        ...noticeInAppBrowserOptions,
        controlsColor: color.fg.brand,
        toolbarColor: color.bg.layerDefault,
      });
    },
    [sourceUrl, color],
  );

  const openSources = useCallback(() => setSourcesOpen(true), []);
  const closeSources = useCallback(() => setSourcesOpen(false), []);
  const openSourceFromSources = useCallback(() => {
    sourceAfterDismiss.current = true;
    setSourcesOpen(false);
  }, []);
  // QUIRK(gorhom-bottom-sheet): a modal presented over the open sheet stacks under it, so the source opens only once the sheet has dismissed.
  const onSourcesDismiss = useCallback(() => {
    setSourcesOpen(false);
    if (!sourceAfterDismiss.current || !sourceUrl) return;
    sourceAfterDismiss.current = false;
    logNoticesContentSelect({ content_type: 'detail_view_source', item_id: itemId });
    void openInAppBrowser(sourceUrl, {
      ...noticeInAppBrowserOptions,
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

  const onLinkPress = useCallback((link: NoticeRefLink) => {
    void openExternalUrl(toLinkHref(link.url));
  }, []);

  const onPhonePress = useCallback((phone: string) => {
    void openExternalUrl(toTelHref(phone));
  }, []);

  const onScheduleMapPress = useCallback(
    (target: NoticeScheduleMapTarget) => {
      logNoticesContentSelect({ content_type: 'detail_schedule_map', item_id: itemId });
      const place = { kind: 'skku_building', placeId: String(target.skkuId) } as const;
      openMapPlace(target.spaceCd === null ? place : { ...place, highlightSpaceCd: target.spaceCd }, 'notice', {
        href: '/notices/[sourceId]/[articleNo]',
        params: { sourceId, articleNo: String(articleNo) },
      });
    },
    [itemId, sourceId, articleNo],
  );

  const onEmailPress = useCallback((email: string) => {
    void openExternalUrl(toMailtoHref(email));
  }, []);

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
    hasFullBody: fullBody !== null,
    sourcesOpen,
    toastText,
    reviewHost: review.host,
    onRetry: refetch,
    onRemoveBookmark,
    onSave,
    onShare,
    openFullBody,
    openSources,
    closeSources,
    openSourceFromSources,
    onSourcesDismiss,
    onAttachmentPress,
    onLinkPress,
    onPhonePress,
    onEmailPress,
    onScheduleMapPress,
    onToastClose: () => setToastText(null),
  };
}
