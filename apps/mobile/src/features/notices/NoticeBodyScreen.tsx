import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Toast, createThemedStyles } from '@skkuverse/sds';
import { NoticeEmptyState } from './NoticeEmptyState';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeMarkdownView } from './NoticeMarkdownView';
import { useNoticeBodyScreen } from './useNoticeBodyScreen';

interface Props {
  sourceId: string;
  articleNo: number;
}

export function NoticeBodyScreen({ sourceId, articleNo }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const vm = useNoticeBodyScreen(sourceId, articleNo);
  const { status } = vm;

  // WHY: one Stack.Screen at a stable position, so the loading, error and success branches never
  // unregister and re-register the header.
  return (
    <View style={styles.container}>
      <Stack.Screen options={HEADER_OPTIONS} />
      {status === 'loading' ? (
        <NoticeListSkeleton />
      ) : status === 'error' ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={vm.onRetry} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.body}>
            <NoticeMarkdownView markdown={vm.markdown} sourceUrl={vm.sourceUrl} onCopyText={vm.onCopy} />
          </View>
        </ScrollView>
      )}
      <Toast
        open={vm.toastText !== null}
        text={vm.toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={vm.onToastClose}
      />
    </View>
  );
}

const HEADER_OPTIONS = { title: '' };

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    paddingBottom: SdsSpacing.x8,
  },
  body: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
  },
}));
