import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefSource } from '../notice-brief.types';

const EMBLEM = require('../../../../assets/images/skku-emblem.png');
const EMBLEM_SIZE = 20;
const SOURCE_COUNT = 1;

interface Props {
  title: string;
  source: NoticeBriefSource;
  onSourcePress: () => void;
  onTitleLayout: (event: LayoutChangeEvent) => void;
}

export function NoticeBriefHeader({ title, source, onSourcePress, onTitleLayout }: Props) {
  const styles = useStyles();
  const { t, tpl } = useT();
  const meta = [tpl('notices.brief.sourceCount', SOURCE_COUNT), source.isEdited ? t('notices.edited') : null]
    .filter((part) => part)
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <Txt
        typography="t9"
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
