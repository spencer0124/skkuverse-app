import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles } from '@skkuverse/sds';
import { toNoticeBriefAge, type NoticeBriefAge } from '../notice-brief.rules';
import type { NoticeBriefSource } from '../notice-brief.types';

const EMBLEM = require('../../../../assets/images/skku-emblem.png');
const EMBLEM_SIZE = 20;
const SOURCE_COUNT = 1;

interface Props {
  title: string;
  source: NoticeBriefSource;
  now: Date;
  onSourcePress: () => void;
  onTitleLayout: (event: LayoutChangeEvent) => void;
}

export function NoticeBriefHeader({ title, source, now, onSourcePress, onTitleLayout }: Props) {
  const styles = useStyles();
  const { t, tpl } = useT();
  const age = formatAge(toNoticeBriefAge(source.firstSeenAt, now), t, tpl);
  const meta = [tpl('notices.brief.sourceCount', SOURCE_COUNT), age, source.isEdited ? t('notices.edited') : null]
    .filter((part) => part)
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <Txt
        typography="t10"
        fontWeight="bold"
        color="neutral"
        lineBreakStrategyIOS="hangul-word"
        onLayout={onTitleLayout}
      >
        {title}
      </Txt>
      <Pressable
        onPress={onSourcePress}
        accessibilityRole="button"
        accessibilityLabel={`${t('notices.brief.sourcesTitle')}, ${meta}`}
        bg="neutralWeak"
        style={styles.pill}
      >
        <Image source={EMBLEM} style={styles.emblem} />
        <Txt typography="t4" color="neutralMuted" numberOfLines={1} style={styles.shrink}>
          {meta}
        </Txt>
      </Pressable>
    </View>
  );
}

function formatAge(
  age: NoticeBriefAge,
  t: ReturnType<typeof useT>['t'],
  tpl: ReturnType<typeof useT>['tpl'],
): string {
  switch (age.kind) {
    case 'justNow':
      return t('notices.brief.justNow');
    case 'minutes':
      return tpl('notices.brief.minutesAgo', age.count);
    case 'hours':
      return tpl('notices.brief.hoursAgo', age.count);
    case 'yesterday':
      return t('notices.day.yesterday');
    case 'date':
      return age.label;
  }
}

const useStyles = createThemedStyles(({ color }) => ({
  wrap: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    gap: SdsSpacing.x3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: SdsSpacing.x1_5,
    paddingHorizontal: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x1_5,
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
  emblem: {
    width: EMBLEM_SIZE,
    height: EMBLEM_SIZE,
    borderRadius: SdsRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke.neutralSubtle,
    overflow: 'hidden',
  },
  shrink: {
    flexShrink: 1,
  },
}));
