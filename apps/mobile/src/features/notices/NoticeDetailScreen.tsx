import { useCallback, useState } from 'react';
import { Platform, Share, View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { BookmarkIcon, DownloadIcon, EyeIcon, ArrowSquareOutIcon, PaperclipIcon, ShareNetworkIcon } from 'phosphor-react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  SdsColors,
  useNoticeDetail,
  useT,
} from '@skkuverse/shared';
import { Toast, Txt } from '@skkuverse/sds';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { SummaryCard } from './SummaryCard';
import { NoticeMarkdownView } from './NoticeMarkdownView';
import { formatDisplayDate } from './utils/formatDisplayDate';

const ICON_BOOKMARK = require('../../../assets/header-icons/bookmark-simple.png');
const ICON_BOOKMARK_FILL = require('../../../assets/header-icons/bookmark-simple-fill.png');
const ICON_SHARE = require('../../../assets/header-icons/share-network.png');

const SHARE_URL = 'https://skkuverse.com';

interface Props {
  sourceId: string;
  articleNo: number;
}

export function NoticeDetailScreen({ sourceId, articleNo }: Props) {
  const { t, tpl } = useT();
  const { data, isLoading, isError, refetch } = useNoticeDetail(sourceId, articleNo);
  const [toastText, setToastText] = useState<string | null>(null);
  // Local-only visual toggle for the bookmark icon. No persistence yet —
  // wired to a real bookmark store in a follow-up. Resets on screen unmount.
  const [saved, setSaved] = useState(false);

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
    setSaved((prev) => !prev);
  }, []);

  const handleSharePress = useCallback(() => {
    // RN's built-in `Share` opens the platform-native share sheet:
    //   iOS  → UIActivityViewController (AirDrop / Messages / Mail / Copy …)
    //   Android → Intent.ACTION_SEND chooser (only `message` is rendered;
    //             `url` is silently ignored, so we duplicate the URL into
    //             `message` to keep parity)
    void Share.share({ message: SHARE_URL, url: SHARE_URL });
  }, []);

  // Header right items — iOS uses native UIBarButtonItem so each gets its own
  // Liquid Glass capsule (`sharesBackground: false`); Android falls back to
  // JSX `headerRight` with `HeaderIconButton`. Same dispatch pattern as the
  // home tab's profile/settings icons (see app/(tabs)/home/index.tsx).
  // The bookmark icon swaps between the regular outline (GREY_700) and the
  // fill weight (BLUE_500) baked PNGs based on `saved`. The Stack.Screen
  // options object is rebuilt on each render, so changing `saved` causes
  // react-native-screens to refresh the bar items.
  const headerOptions =
    Platform.OS === 'ios'
      ? {
          title: '',
          unstable_headerRightItems: () => [
            {
              type: 'button' as const,
              label: t('notices.save'),
              icon: {
                type: 'image' as const,
                source: saved ? ICON_BOOKMARK_FILL : ICON_BOOKMARK,
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: t('notices.save'),
              onPress: handleSavePress,
            },
            {
              type: 'button' as const,
              label: t('notices.share'),
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
                accessibilityLabel={t('notices.save')}
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <NoticeListSkeleton />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />
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

        {data.summary ? <SummaryCard summary={data.summary} /> : null}

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
                    onPress={() => openAttachment(a.url, 'download', a.name)}
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
          onPress={openOriginal}
          style={({ pressed }) => [styles.openOriginal, pressed && styles.pressed]}
        >
          <ArrowSquareOutIcon size={16} color={SdsColors.grey800} />
          <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
            {t('notices.openOriginal')}
          </Txt>
        </Pressable>
      </ScrollView>
      <Toast
        open={toastText !== null}
        text={toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={() => setToastText(null)}
      />
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

