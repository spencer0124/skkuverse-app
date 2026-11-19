import { View, type LayoutChangeEvent } from 'react-native';
import { MegaphoneSimpleIcon } from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { toNoticeBriefAge, type NoticeBriefAge } from '../notice-brief.rules';
import type { NoticeBriefSource } from '../notice-brief.types';

interface Props {
  title: string;
  source: NoticeBriefSource;
  now: Date;
  onSourcePress: () => void;
  onTitleLayout: (event: LayoutChangeEvent) => void;
}

export function NoticeBriefHeader({ title, source, now, onSourcePress, onTitleLayout }: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const age = formatAge(toNoticeBriefAge(source.firstSeenAt, now), t, tpl);
  const meta = [source.boardName, age, source.isEdited ? t('notices.edited') : null]
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
        accessibilityRole="link"
        accessibilityLabel={`${meta}, ${t('notices.openOriginal')}`}
        bg="neutralWeak"
        style={styles.pill}
      >
        <MegaphoneSimpleIcon size={16} color={color.fg.neutralSubtle} weight="fill" />
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

const useStyles = createThemedStyles(() => ({
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
  shrink: {
    flexShrink: 1,
  },
}));
