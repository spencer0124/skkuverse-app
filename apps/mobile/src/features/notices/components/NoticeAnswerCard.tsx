/**
 * The answer that appears above the notice results after the user submits.
 *
 * Placement: rendered as the results FlatList's `ListHeaderComponent`, so it
 * scrolls away with the results instead of permanently eating viewport. The
 * list renders on its own timeline and never waits on this — a ranked list can
 * plausibly land inside the ~1s "flow of thought" budget, a generated answer
 * cannot, so blocking one on the other would make both feel slow.
 *
 * ── Hierarchy: answer first, qualifications second ──
 *
 * The first version rendered one flat paragraph and everything under it at the
 * same weight, so the eye had nowhere to land — a wall of equal-sized text
 * where the actual answer to "신청 마감 언제야?" was buried mid-sentence.
 *
 * Now it reads top-down by importance: a 22px headline that answers outright,
 * then grey elaboration, then sources, then follow-ups as thin rows. Same
 * split the app already uses for a notice's own summary (`oneLiner` + `text`),
 * so the answer looks like the rest of the product rather than a bolted-on
 * panel. This is Toss writing principle #4 — cut what the reader already
 * knows, lead with what they came for — applied to layout instead of copy.
 *
 * Chat-derived, deliberately: bare prose on the page background (a filled card
 * reads as "a widget the system inserted"), generous line height, a live
 * indicator while generating, tappable follow-ups. NOT taken from chat: no
 * message history, no echo of the question (it is still in the search field
 * above), no bottom composer. The results list stays the backbone.
 *
 * Copy: the label is "한눈에", never "AI 답변" — labeling a feature "AI"
 * measurably lowers performance expectations without any trust gain, and the
 * sparkle icon tested as meaningless on its own (NN/g, n=107). The brand dot
 * here is never shown without that text label beside it.
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CaretRightIcon, XIcon } from 'phosphor-react-native';
import { SdsColors, SdsRadius, SdsSpacing, useT } from '@skkuverse/shared';
import { Txt, colorSeeds, timingConfig } from '@skkuverse/sds';
import { EnterUp, PressableScale, STAGGER_MS } from '@/components/motion';
import type {
  NoticeAnswerCitation,
  NoticeAnswerState,
} from '../hooks/useNoticeAnswer';

const COLLAPSED_LINES = 3;
const EXPAND_THRESHOLD = 90;

/**
 * Height held open from the moment the request starts until the answer
 * settles. Without it every streamed chunk would reflow the block and shove
 * the notice rows below it down the screen — the canonical streaming
 * anti-pattern, and the one thing that makes a streaming UI feel broken.
 */
const RESERVED_HEIGHT = 116;

/**
 * Three dots breathing in sequence. Used both while retrieval runs and while
 * tokens stream — "silence feels like failure", so a wait has to look alive or
 * a 2s pause reads as a hang.
 *
 * This is deliberately NOT an inline text caret. React Native cannot nest an
 * `Animated.View` inside `<Text>` — the same constraint that forces
 * `NoticeMarkdownView.paragraph()` to split between a `View` and a `Text`
 * depending on whether the paragraph contains an image.
 */
function ThinkingDots() {
  const reduced = useReducedMotion();
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <ThinkingDot key={i} index={i} reduced={reduced} />
      ))}
    </View>
  );
}

function ThinkingDot({ index, reduced }: { index: number; reduced: boolean }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    if (reduced) {
      opacity.value = 0.5;
      return;
    }
    // Offset the phase per dot instead of using withDelay, so the loop stays
    // in sync forever rather than drifting after the first cycle.
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: index * 160 }),
        withTiming(1, timingConfig('ease', 380)),
        withTiming(0.25, timingConfig('ease', 380)),
        withTiming(0.25, { duration: (2 - index) * 160 }),
      ),
      -1,
    );
  }, [index, reduced, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, animated]} />;
}

interface Props {
  state: NoticeAnswerState;
  onCitationPress: (citation: NoticeAnswerCitation) => void;
  onFollowUpPress: (question: string) => void;
  onDismiss: () => void;
}

export function NoticeAnswerCard({
  state,
  onCitationPress,
  onFollowUpPress,
  onDismiss,
}: Props) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);

  if (state.status === 'unavailable') return null;

  // Abstain and error stay deliberately small — they are not answers, and
  // dressing them up as one would imply more than the system knows.
  if (state.status === 'abstained' || state.status === 'error') {
    return (
      <EnterUp style={styles.notice}>
        <Txt typography="t7" color={SdsColors.grey500}>
          {state.status === 'abstained'
            ? t('notices.answer.abstained')
            : t('notices.answer.error')}
        </Txt>
      </EnterUp>
    );
  }

  const isSettled = state.status === 'done';
  const isPending = state.status === 'pending';
  const headline = isPending ? null : state.headline;
  const text = isPending ? '' : state.text;
  const citations = isPending ? [] : state.citations;
  const followUps = isSettled ? state.followUps.slice(0, 3) : [];

  return (
    <EnterUp style={[styles.block, !isSettled && { minHeight: RESERVED_HEIGHT }]}>
      <View style={styles.labelRow}>
        <View style={styles.label}>
          <View style={styles.brandDot} />
          <Txt typography="t7" color={SdsColors.grey400}>
            {t('notices.answer.title')}
          </Txt>
        </View>
        {isSettled && (
          <PressableScale
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('notices.answer.dismiss')}
          >
            <XIcon size={15} color={SdsColors.grey300} />
          </PressableScale>
        )}
      </View>

      {isPending ? (
        <View style={styles.pendingRow}>
          <ThinkingDots />
          <Txt typography="t6" color={SdsColors.grey400}>
            {t('notices.answer.pending')}
          </Txt>
        </View>
      ) : (
        <View style={styles.answerBody}>
          {/* The answer itself. Arrives whole and immediately — it is one
              short line, so streaming it would delay the only part the reader
              actually needs. */}
          {headline ? (
            <Txt typography="t3" color={SdsColors.grey900}>
              {headline}
            </Txt>
          ) : null}

          <Txt
            typography="t6"
            color={SdsColors.grey600}
            numberOfLines={expanded ? undefined : COLLAPSED_LINES}
            style={styles.prose}
          >
            {text}
          </Txt>

          {!isSettled ? <ThinkingDots /> : null}

          {isSettled && text.length > EXPAND_THRESHOLD && (
            <PressableScale onPress={() => setExpanded((v) => !v)} hitSlop={8}>
              <Txt typography="t7" fontWeight="semibold" color={SdsColors.grey500}>
                {expanded ? t('notices.answer.less') : t('notices.answer.more')}
              </Txt>
            </PressableScale>
          )}
        </View>
      )}

      {citations.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.citationRow}
        >
          {citations.map((citation, i) => (
            <EnterUp
              key={`${citation.sourceId}/${citation.articleNo}`}
              delay={i * STAGGER_MS}
            >
              <PressableScale
                onPress={() => onCitationPress(citation)}
                style={styles.citationChip}
                accessibilityRole="button"
              >
                <Txt typography="t7" color={SdsColors.grey600}>
                  {`${citation.label} · ${citation.date}`}
                </Txt>
              </PressableScale>
            </EnterUp>
          ))}
        </ScrollView>
      )}

      {followUps.length > 0 && (
        <View style={styles.followUpBlock}>
          {followUps.map((question, i) => (
            <EnterUp key={question} delay={i * STAGGER_MS}>
              <PressableScale
                onPress={() => onFollowUpPress(question)}
                style={styles.followUpRow}
                accessibilityRole="button"
              >
                <Txt
                  typography="t6"
                  color={SdsColors.grey700}
                  style={styles.followUpText}
                  numberOfLines={1}
                >
                  {question}
                </Txt>
                <CaretRightIcon size={14} color={SdsColors.grey300} />
              </PressableScale>
            </EnterUp>
          ))}
        </View>
      )}

      {/* Names the zone below so the answer and the ranked list read as two
          things rather than one long scroll. */}
      {isSettled && (
        <View style={styles.resultsHeader}>
          <Txt typography="t7" fontWeight="semibold" color={SdsColors.grey500}>
            {t('notices.search.resultsTitle')}
          </Txt>
        </View>
      )}
    </EnterUp>
  );
}

const styles = StyleSheet.create({
  // No fill, no border, no radius: bare prose on the page is what makes this
  // read as a reply rather than an inserted widget.
  block: {
    paddingHorizontal: SdsSpacing.base,
    paddingTop: SdsSpacing.md,
    gap: SdsSpacing.base,
  },
  notice: {
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Brand mark, never shown without the text label beside it.
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colorSeeds.primary,
  },
  answerBody: {
    gap: SdsSpacing.sm,
    alignItems: 'flex-start',
  },
  prose: {
    lineHeight: 23,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.sm,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colorSeeds.primary,
  },
  citationRow: {
    gap: 6,
    paddingRight: SdsSpacing.base,
  },
  // Filled rather than outlined — three bordered pills in a row read as three
  // buttons competing with the follow-ups below them.
  citationChip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey100,
  },
  // Hairline-separated rows, not bordered boxes. Three outlined cards stacked
  // vertically took half the screen and read as the primary content; these
  // read as what they are — optional next questions.
  followUpBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SdsColors.grey200,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SdsSpacing.sm,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey200,
  },
  followUpText: {
    flexShrink: 1,
  },
  resultsHeader: {
    paddingTop: SdsSpacing.xs,
  },
});
