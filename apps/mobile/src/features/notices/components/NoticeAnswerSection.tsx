import { View } from 'react-native';
import { InfoIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Border, ListHeader, Pressable, TextButton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { NoticeBriefAnswer } from '../notice-brief.types';

interface Props {
  answer: NoticeBriefAnswer;
  onInfoPress: () => void;
  onViewAll: (() => void) | null;
}

export function NoticeAnswerSection({ answer, onInfoPress, onViewAll }: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();

  return (
    <View>
      <ListHeader
        style={styles.header}
        title={
          <View style={styles.titleRow}>
            <ListHeader.TitleParagraph typography="t9" fontWeight="bold" style={styles.shrink}>
              {answer.question}
            </ListHeader.TitleParagraph>
            <Pressable
              onPress={onInfoPress}
              accessibilityRole="button"
              accessibilityLabel={t('notices.brief.answerInfo')}
              hitSlop={SdsSpacing.x2}
              bg="transparent"
            >
              <InfoIcon size={20} color={color.fg.neutralSubtle} />
            </Pressable>
          </View>
        }
        right={<ListHeader.RightText typography="t3" color="neutralSubtle">{answer.label}</ListHeader.RightText>}
      />
      <View style={styles.bullets}>
        {answer.bullets.length > 0 ? (
          answer.bullets.map((bullet, index) => (
            <View key={index} style={styles.bullet}>
              <Txt typography="t7" color="neutralMuted" style={styles.dot}>
                {'•'}
              </Txt>
              <Txt typography="t7" color="neutralMuted" lineBreakStrategyIOS="hangul-word" style={styles.shrink}>
                {bullet.text}
              </Txt>
            </View>
          ))
        ) : (
          <Txt typography="t7" color="neutralSubtle">
            {t('notices.brief.empty')}
          </Txt>
        )}
      </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  shrink: {
    flexShrink: 1,
  },
  bullets: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x6,
    gap: SdsSpacing.x3,
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
