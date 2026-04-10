import { useCallback } from 'react';
import { View, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { ExternalLink, Paperclip } from 'lucide-react-native';
import {
  SdsColors,
  useNoticeDetail,
  useT,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { NoticeNavBar } from './NavigationBar';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { SummaryCard } from './SummaryCard';
import { NoticeHtmlView } from './NoticeHtmlView';

interface Props {
  deptId: string;
  articleNo: number;
}

export function NoticeDetailScreen({ deptId, articleNo }: Props) {
  const { t, tpl } = useT();
  const { data, isLoading, isError, refetch } = useNoticeDetail(deptId, articleNo);

  const openOriginal = useCallback(() => {
    if (!data?.sourceUrl) return;
    void Linking.openURL(data.sourceUrl).catch(() => {});
  }, [data?.sourceUrl]);

  const openAttachment = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {});
  }, []);

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
        <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
          {data.title}
        </Txt>

        <View style={styles.metaRow}>
          <Txt typography="t7" color={SdsColors.grey500}>
            {data.date}
          </Txt>
          {data.author ? (
            <>
              <Dot />
              <Txt typography="t7" color={SdsColors.grey500}>
                {data.author}
              </Txt>
            </>
          ) : null}
          {data.views > 0 ? (
            <>
              <Dot />
              <Txt typography="t7" color={SdsColors.grey500}>
                {tpl('notices.views', data.views)}
              </Txt>
            </>
          ) : null}
        </View>

        {data.summary ? <SummaryCard summary={data.summary} /> : null}

        <View style={styles.divider} />

        <NoticeHtmlView
          html={data.contentHtml}
          fallbackText={data.contentText}
          sourceUrl={data.sourceUrl}
        />

        {data.attachments.length > 0 ? (
          <View style={styles.attachments}>
            <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
              {t('notices.attachments')}
            </Txt>
            {data.attachments.map((a) => (
              <Pressable
                key={a.url}
                onPress={() => openAttachment(a.url)}
                style={({ pressed }) => [styles.attachmentRow, pressed && styles.pressed]}
              >
                <Paperclip size={14} color={SdsColors.grey600} />
                <Txt typography="t6" color={SdsColors.blue500} numberOfLines={1} style={styles.attachmentName}>
                  {a.name}
                </Txt>
              </Pressable>
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
    </View>
  );
}

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
  divider: {
    height: 0.5,
    backgroundColor: SdsColors.grey200,
    marginVertical: 14,
  },
  attachments: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: SdsColors.grey50,
    gap: 8,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  attachmentName: {
    flex: 1,
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

