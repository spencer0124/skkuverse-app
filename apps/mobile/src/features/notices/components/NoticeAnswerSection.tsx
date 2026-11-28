import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefAnswer, NoticeBriefAttachment } from '../notice-brief.types';
import { NoticeImageAttachments } from './NoticeImageAttachments';
import { NoticeViewAllButton } from './NoticeViewAllButton';

interface Props {
  answer: NoticeBriefAnswer;
  images: NoticeBriefAttachment[];
  sourceUrl: string;
  onImagePress: () => void;
  onViewAll: (() => void) | null;
}

export function NoticeAnswerSection({ answer, images, sourceUrl, onImagePress, onViewAll }: Props) {
  const styles = useStyles();

  return (
    <View style={[styles.wrap, onViewAll ? styles.wrapWithViewAll : null]}>
      <View style={[styles.bullets, onViewAll ? styles.bulletsAboveViewAll : null]}>
        {answer.bullets.map((bullet, index) => (
          <View key={index} style={styles.bullet}>
            <Txt typography="t7" color="neutralMuted" style={styles.dot}>
              {'•'}
            </Txt>
            <Txt
              typography="t7"
              color="neutralMuted"
              lineBreakStrategyIOS="hangul-word"
              accessibilityLanguage={answer.language ?? undefined}
              style={styles.shrink}
            >
              {bullet.text}
            </Txt>
          </View>
        ))}
      </View>
      {images.length > 0 ? <NoticeImageAttachments images={images} sourceUrl={sourceUrl} onPress={onImagePress} /> : null}
      {onViewAll ? <NoticeViewAllButton onPress={onViewAll} /> : null}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  wrap: {
    paddingTop: SdsSpacing.x8,
    paddingBottom: SdsSpacing.x6,
  },
  shrink: {
    flexShrink: 1,
  },
  bullets: {
    paddingHorizontal: SdsSpacing.gutter,
    gap: SdsSpacing.x3,
  },
  bullet: {
    flexDirection: 'row',
    paddingLeft: SdsSpacing.x1,
  },
  wrapWithViewAll: {
    paddingBottom: 0,
  },
  // WHY: the gap of one bullet to the next, so the way to the full text reads as part of the bullets.
  bulletsAboveViewAll: {
    paddingBottom: SdsSpacing.x3,
  },
  dot: {
    width: SdsSpacing.x5,
  },
}));
