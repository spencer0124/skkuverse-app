import { Fragment, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { BookmarkSimpleIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Border, Toast, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { InlineBanner } from '@/features/ads/InlineBanner';
import { AdUnitIds } from '@/platform/ads';
import { ReviewPromptHost } from '@/features/feedback/ReviewPromptHost';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './NoticeEmptyState';
import { DeletedNoticeTombstone } from './DeletedNoticeTombstone';
import { NoticeAnswerSection } from './components/NoticeAnswerSection';
import { NoticeAudienceTable } from './components/NoticeAudienceTable';
import { NoticeBodySection } from './components/NoticeBodySection';
import { NoticeBriefHeader } from './components/NoticeBriefHeader';
import { NoticeScheduleSection } from './components/NoticeScheduleSection';
import { NoticeRefsSection } from './components/NoticeRefsSection';
import { NoticeSourcesSheet } from './components/NoticeSourcesSheet';
import { useCollapsingTitle } from './components/useCollapsingTitle';
import { useNoticeDetailHeaderOptions } from './components/useNoticeDetailHeaderOptions';
import { hasViewAllUnderBullets, toNoticeBriefParts } from './notice-brief.rules';
import { useNoticeDetailScreen } from './useNoticeDetailScreen';

interface Props {
  sourceId: string;
  articleNo: number;
  source?: string;
}

export function NoticeDetailScreen({ sourceId, articleNo, source }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const color = useSemanticColors();
  const [now] = useState(() => new Date());
  const vm = useNoticeDetailScreen({
    sourceId,
    articleNo,
    source,
    reviewIcon: <BookmarkSimpleIcon size={32} color={color.fg.brandContrast} weight="fill" />,
  });
  const parts = vm.status === 'ready' ? toNoticeBriefParts(vm.notice, vm.hasFullBody) : [];
  const collapsing = useCollapsingTitle();
  const headerOptions = useNoticeDetailHeaderOptions({
    tombstone: vm.status === 'deleted',
    saved: vm.saved,
    onSave: vm.onSave,
    onShare: vm.onShare,
    collapsedTitle: vm.status === 'ready' ? vm.notice.title : null,
    titleOpacity: collapsing.opacity,
  });

  // WHY: one Stack.Screen at a stable position, so the loading, error and success branches never
  // unregister and re-register the header.
  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />
      {vm.status === 'loading' ? (
        <NoticeListSkeleton />
      ) : vm.status === 'deleted' ? (
        <DeletedNoticeTombstone
          entry={vm.entry}
          onRemove={vm.onRemoveBookmark}
          isRemoving={vm.isRemoving}
        />
      ) : vm.status === 'error' ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={vm.onRetry} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          onScroll={collapsing.onScroll}
          scrollEventThrottle={16}
        >
          <NoticeBriefHeader
            title={vm.notice.title}
            source={vm.notice.source}
            onSourcePress={vm.openSources}
            onTitleLayout={collapsing.onTitleLayout}
          />
          {parts.map(({ part, hasDividerBefore }, index) => (
            <Fragment key={part}>
              {hasDividerBefore ? <Border variant="height16" /> : null}
              {part === 'audience' ? (
                vm.notice.audience !== null ? <NoticeAudienceTable audience={vm.notice.audience} /> : null
              ) : part === 'schedule' ? (
                <NoticeScheduleSection
                  schedule={vm.notice.schedule ?? []}
                  now={now}
                  onMapPress={vm.onScheduleMapPress}
                  isJoinedAbove={index > 0 && !hasDividerBefore}
                />
              ) : part === 'bullets' ? (
                vm.notice.answer !== null ? (
                  <NoticeAnswerSection
                    answer={vm.notice.answer}
                    images={vm.notice.images}
                    sourceUrl={vm.notice.source.url}
                    onImagePress={vm.openFullBody}
                    onViewAll={hasViewAllUnderBullets(vm.notice, vm.hasFullBody) ? vm.openFullBody : null}
                  />
                ) : null
              ) : part === 'refs' ? (
                <NoticeRefsSection
                  refs={vm.notice.refs}
                  onAttachmentPress={vm.onAttachmentPress}
                  onLinkPress={vm.onLinkPress}
                  onPhonePress={vm.onPhonePress}
                  onEmailPress={vm.onEmailPress}
                />
              ) : (
                <NoticeBodySection
                  images={vm.notice.images}
                  sourceUrl={vm.notice.source.url}
                  onImagePress={vm.openFullBody}
                  onViewAll={vm.hasFullBody && !hasViewAllUnderBullets(vm.notice, vm.hasFullBody) ? vm.openFullBody : null}
                />
              )}
            </Fragment>
          ))}
          <Border variant="height16" />
          {/* WHY: maxHeight reserves the slot, since a late load pushing content is a misclick. */}
          <InlineBanner unitId={AdUnitIds.noticeDetailBanner} maxHeight={250} />
        </ScrollView>
      )}
      {vm.status === 'ready' ? (
        <NoticeSourcesSheet
          open={vm.sourcesOpen}
          title={vm.notice.title}
          source={vm.notice.source}
          onRowPress={vm.openSourceFromSources}
          onClose={vm.closeSources}
          onDismiss={vm.onSourcesDismiss}
        />
      ) : null}
      <Toast
        open={vm.toastText !== null}
        text={vm.toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={vm.onToastClose}
      />
      <ReviewPromptHost {...vm.reviewHost} />
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
}));
