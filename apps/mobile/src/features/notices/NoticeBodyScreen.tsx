import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import type { NativeStackNavigationOptions } from 'expo-router';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Toast, Txt, createThemedStyles } from '@skkuverse/sds';
import { NoticeCollapsedTitle } from './components/NoticeCollapsedTitle';
import { useCollapsingTitle } from './components/useCollapsingTitle';
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
  const collapsing = useCollapsingTitle();
  const { title, status } = vm;
  const headerOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      title: '',
      headerTitle: title ? () => <NoticeCollapsedTitle title={title} opacity={collapsing.opacity} /> : undefined,
    }),
    [title, collapsing.opacity],
  );

  // WHY: one Stack.Screen at a stable position, so the loading, error and success branches never
  // unregister and re-register the header.
  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />
      {status === 'loading' ? (
        <NoticeListSkeleton />
      ) : status === 'error' ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={vm.onRetry} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          onScroll={collapsing.onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.titleWrap}>
            <Txt
              typography="t10"
              fontWeight="bold"
              color="neutral"
              lineBreakStrategyIOS="hangul-word"
              onLayout={collapsing.onTitleLayout}
            >
              {title}
            </Txt>
          </View>
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

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    paddingBottom: SdsSpacing.x8,
  },
  titleWrap: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x6,
  },
  body: {
    paddingHorizontal: SdsSpacing.gutter,
  },
}));
