/**
 * What the search screen shows before anything has been asked.
 *
 * A brand mark, a greeting, and three real campus questions — centered in the
 * space above the composer rather than stacked from the top. The empty middle
 * is doing work: it makes the composer the obvious place to act, which is the
 * whole point of moving the input to the bottom.
 *
 * This is the only onboarding surface for natural-language search that
 * reliably lands. Users arrive from the search pill, never from a first-run
 * tour, so a dedicated "you can ask questions now" screen would go unseen —
 * NN/g watched exactly that with Google's AI Mode, where participants entered
 * from the browser bar, skipped onboarding, and kept typing keywords out of
 * habit. Seeing a finished question is what teaches the format; a hint that
 * says "you can ask questions" does not.
 *
 * The suggestions are deliberately NOT keyed by tab. A `Record<tabKey, …>` map
 * here would be a fourth site hard-coding notice tab keys ('dept', 'academic',
 * …), which CLAUDE.md calls out as a cross-cutting rename hazard. Per-tab
 * suggestions belong in the server tab config if they are ever wanted.
 */

import { StyleSheet, View } from 'react-native';
import { SdsColors, SdsRadius, SdsSpacing, useT } from '@skkuverse/shared';
import { Txt, colorSeeds } from '@skkuverse/sds';
import { EnterUp, PressableScale, STAGGER_MS } from '@/components/motion';

interface Props {
  onPickQuery: (query: string) => void;
}

export function NoticesSearchIdleState({ onPickQuery }: Props) {
  const { t } = useT();

  const suggestions = [
    t('notices.search.suggest.q1'),
    t('notices.search.suggest.q2'),
    t('notices.search.suggest.q3'),
  ];

  return (
    <View style={styles.container}>
      <EnterUp style={styles.greetingBlock}>
        <View style={styles.mark} />
        <Txt
          typography="t4"
          color={SdsColors.grey900}
          style={styles.greeting}
        >
          {t('notices.search.idle.greeting')}
        </Txt>
      </EnterUp>

      <View style={styles.suggestList}>
        {suggestions.map((question, i) => (
          <EnterUp key={question} delay={(i + 1) * STAGGER_MS}>
            <PressableScale
              onPress={() => onPickQuery(question)}
              style={styles.suggestChip}
              accessibilityRole="button"
            >
              <Txt typography="t7" color={SdsColors.grey600}>
                {question}
              </Txt>
            </PressableScale>
          </EnterUp>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.xl,
    gap: SdsSpacing.xl,
  },
  greetingBlock: {
    alignItems: 'center',
    gap: SdsSpacing.base,
  },
  // Brand mark. Kept abstract rather than a sparkle: NN/g (n=107) found nobody
  // reads ✨ as "artificial intelligence", so the icon would carry no meaning
  // it isn't already getting from the sentence underneath it.
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colorSeeds.primary,
    opacity: 0.9,
  },
  greeting: {
    textAlign: 'center',
  },
  // Chips, not full-width rows: centered under a centered greeting, wrapped
  // rows would fight the composition. These read as examples, not as a menu.
  suggestList: {
    alignItems: 'center',
    gap: SdsSpacing.sm,
  },
  suggestChip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: SdsRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SdsColors.grey200,
  },
});
