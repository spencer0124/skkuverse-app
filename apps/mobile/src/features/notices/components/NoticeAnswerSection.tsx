import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Border, ListHeader, TextButton, Txt, createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefAnswer, NoticeBriefPoster } from '../notice-brief.types';
import { NoticePosterStrip } from './NoticePosterStrip';

interface Props {
  answer: NoticeBriefAnswer | null;
  posters: NoticeBriefPoster[];
  sourceUrl: string;
  onPosterPress: () => void;
  onViewAll: (() => void) | null;
}

export function NoticeAnswerSection({ answer, posters, sourceUrl, onPosterPress, onViewAll }: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View>
      {answer !== null ? (
        <>
          {answer.question !== null ? (
            <ListHeader
              style={styles.header}
              title={
                <ListHeader.TitleParagraph typography="t9" fontWeight="bold">
                  {answer.question}
                </ListHeader.TitleParagraph>
              }
            />
          ) : null}
          <View style={[styles.bullets, answer.question === null ? styles.bulletsWithoutHeader : null]}>
            {answer.bullets.map((bullet, index) => (
              <View key={index} style={styles.bullet}>
                <Txt typography="t7" color="neutralMuted" style={styles.dot}>
                  {'•'}
                </Txt>
                <Txt typography="t7" color="neutralMuted" lineBreakStrategyIOS="hangul-word" style={styles.shrink}>
                  {bullet.text}
                </Txt>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {posters.length > 0 ? (
        <View style={[styles.posters, answer === null ? styles.postersWithoutAnswer : null]}>
          <NoticePosterStrip posters={posters} sourceUrl={sourceUrl} onPress={onPosterPress} />
        </View>
      ) : null}
      {onViewAll ? (
        <>
          <Border variant="full" />
          <TextButton
            typography="t6"
            variant="arrow"
            color="neutralMuted"
            onPress={onViewAll}
            style={styles.viewAll}
          >
            {t('notices.brief.viewAll')}
          </TextButton>
        </>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  header: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x8,
    paddingBottom: SdsSpacing.x3,
  },
  shrink: {
    flexShrink: 1,
  },
  bullets: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x6,
    gap: SdsSpacing.x3,
  },
  // WHY: the header's own top padding, kept so the gap under the title pill is the same with or without one.
  bulletsWithoutHeader: {
    paddingTop: SdsSpacing.x8,
  },
  posters: {
    paddingBottom: SdsSpacing.x6,
  },
  // WHY: the header's own top padding, kept so the gap above the posters is the same without an answer.
  postersWithoutAnswer: {
    paddingTop: SdsSpacing.x8,
  },
  bullet: {
    flexDirection: 'row',
    paddingLeft: SdsSpacing.x1,
  },
  dot: {
    width: SdsSpacing.x5,
  },
  viewAll: {
    alignSelf: 'center',
    paddingVertical: SdsSpacing.x5,
  },
}));
