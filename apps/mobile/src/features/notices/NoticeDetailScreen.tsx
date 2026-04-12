import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Download, Eye, ExternalLink, Paperclip } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  ApiConfig,
  SdsColors,
  useNoticeDetail,
  useT,
} from '@skkuverse/shared';
import { Toast, Txt } from '@skkuverse/sds';
import { NoticeNavBar } from './NavigationBar';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { SummaryCard } from './SummaryCard';
import { NoticeMarkdownView } from './NoticeMarkdownView';
import { formatDisplayDate } from './utils/formatDisplayDate';

interface Props {
  deptId: string;
  articleNo: number;
}

export function NoticeDetailScreen({ deptId, articleNo }: Props) {
  const { t, tpl } = useT();
  const { data, isLoading, isError, refetch } = useNoticeDetail(deptId, articleNo);
  const [toastOpen, setToastOpen] = useState(false);

  const handleCopyText = useCallback((text: string) => {
    void Clipboard.setStringAsync(text);
    setToastOpen(true);
  }, []);

  const openOriginal = useCallback(() => {
    if (!data?.sourceUrl) return;
    void WebBrowser.openBrowserAsync(data.sourceUrl, inAppBrowserOptions);
  }, [data?.sourceUrl]);

  const openAttachment = useCallback(
    (url: string, mode: 'inline' | 'download') => {
      const proxyUrl = buildAttachmentUrl(url, data?.sourceUrl ?? '', mode);
      void WebBrowser.openBrowserAsync(proxyUrl, inAppBrowserOptions);
    },
    [data?.sourceUrl],
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <NoticeNavBar title="" />
        <NoticeListSkeleton />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <NoticeNavBar title="" />
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NoticeNavBar title="" />
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
                  <Paperclip size={14} color={SdsColors.grey600} />
                  <Txt typography="t6" color={SdsColors.grey800} numberOfLines={1} style={styles.attachmentName}>
                    {a.name}
                  </Txt>
                </View>
                <View style={styles.attachmentActions}>
                  <Pressable
                    onPress={() => openAttachment(a.url, 'inline')}
                    style={({ pressed }) => [styles.attachmentBtn, pressed && styles.pressed]}
                  >
                    <Eye size={14} color={SdsColors.blue500} />
                    <Txt typography="t7" color={SdsColors.blue500}>
                      {t('notices.preview')}
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => openAttachment(a.url, 'download')}
                    style={({ pressed }) => [styles.attachmentBtn, pressed && styles.pressed]}
                  >
                    <Download size={14} color={SdsColors.blue500} />
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
          <ExternalLink size={16} color={SdsColors.grey800} />
          <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
            {t('notices.openOriginal')}
          </Txt>
        </Pressable>
      </ScrollView>
      <Toast
        open={toastOpen}
        text={t('notices.copied')}
        icon={<Toast.Icon type="check" />}
        onClose={() => setToastOpen(false)}
      />
    </View>
  );
}

function buildAttachmentUrl(
  url: string,
  sourceUrl: string,
  mode: 'inline' | 'download',
): string {
  const params = new URLSearchParams({ url, referer: sourceUrl, mode });
  return `${ApiConfig.baseUrl}/notices/proxy/attachment?${params.toString()}`;
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
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 60,
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

