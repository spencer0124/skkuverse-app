import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SparkleIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { GLOW_BLUR, GlowBackdrop } from '@/components/GlowBackdrop';
import { logNoticesContentSelect, track } from '@/platform/analytics';
import { NoticeOverviewCard } from './NoticeOverviewCard';
import { NoticeOverviewSkeleton } from './NoticeOverviewSkeleton';
import { overviewOutcome } from './overview.rules';
import { useNoticeOverview } from './useNoticeOverview';

const RADIUS = 16;
const ARRIVAL_BREATHS = 2;

interface Props {
  /** WHY: the caller keys the section by it, so a new query starts pending. */
  q: string;
  sourceIds: readonly string[];
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/notices-api.md: a null overview or a failed
 * request hides the section and never retries, since each retry is another LLM call.
 */
export function NoticeOverviewSection({ q, sourceIds }: Props) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();
  const router = useRouter();
  const query = useNoticeOverview({ q, sourceIds });
  const { data, isError } = query;
  const overview = data?.overview ?? null;

  // WHY: taken in an effect, since render must stay pure; the request settles milliseconds later at the earliest.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const tracked = useRef(false);
  const settledAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);
  useEffect(() => {
    const started = startedAt.current;
    if (tracked.current || started === null || query.isFetching || settledAt < started) return;
    const result = overviewOutcome(query.data, query.error);
    if (result === null || result === 'cancelled') return;
    tracked.current = true;
    const answered = query.data?.overview;
    track('notice_overview', {
      result,
      ms: settledAt - started,
      scope: sourceIds.length,
      ...(answered && {
        cached: query.data?.cached ? 'true' : 'false',
        sources: answered.sources.length,
      }),
    });
  }, [query.data, query.error, query.isFetching, settledAt, sourceIds.length]);

  const openSource = useCallback(
    (n: number) => {
      const sources = overview?.sources ?? [];
      const source = sources.find((s) => s.n === n);
      if (!source) return;
      logNoticesContentSelect({
        content_type: 'overview_source',
        item_id: `${source.sourceId}/${source.articleNo}`,
      });
      router.push(`/notices/${source.sourceId}/${source.articleNo}` as never);
    },
    [overview, router],
  );

  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!overview || announced.current === overview.generatedAt) return;
    announced.current = overview.generatedAt;
    const first = overview.lead?.text ?? overview.points[0]?.text ?? '';
    AccessibilityInfo.announceForAccessibility(`${t('notices.overview.label')}. ${first}`);
  }, [overview, t]);

  if (isError || data?.overview === null) return null;

  const pending = overview === null;
  return (
    <Animated.View
      exiting={FadeOut.duration(200)}
      style={styles.card}
      accessibilityState={{ busy: pending }}
    >
      <GlowBackdrop
        color={color.fg.ai}
        tint={color.bg.layerDefault}
        borderRadius={RADIUS}
        breaths={pending ? 'forever' : ARRIVAL_BREATHS}
      />
      <View style={styles.header}>
        <SparkleIcon size={13} color={color.fg.ai} weight="fill" />
        <Txt
          typography="t2"
          fontWeight="semiBold"
          color="ai"
          accessibilityRole="header"
        >
          {t('notices.overview.label')}
        </Txt>
      </View>
      {overview ? (
        <NoticeOverviewCard overview={overview} onOpenSource={openSource} />
      ) : (
        <NoticeOverviewSkeleton />
      )}
    </Animated.View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  // WHY: no overflow clipping, which would cut the glow's shadow; clear of the glow on both sides, since the
  // list clips at its top edge and the first row's opaque background would cover the halo's lower half.
  card: {
    marginHorizontal: SdsSpacing.x4,
    marginTop: GLOW_BLUR,
    marginBottom: GLOW_BLUR,
    paddingHorizontal: SdsSpacing.x3_5,
    paddingVertical: SdsSpacing.x3,
    borderRadius: RADIUS,
    // WHY: the inside is the page surface, so the green stays on the border and the halo.
    backgroundColor: color.bg.layerDefault,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    marginBottom: SdsSpacing.x1_5,
  },
}));
