import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Border, TextButton, createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefPoster } from '../notice-brief.types';
import { NoticePosterStrip } from './NoticePosterStrip';

interface Props {
  posters: NoticeBriefPoster[];
  sourceUrl: string;
  onPosterPress: () => void;
  onViewAll: (() => void) | null;
}

export function NoticeBodySection({ posters, sourceUrl, onPosterPress, onViewAll }: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View>
      {posters.length > 0 ? (
        <View style={styles.posters}>
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
  posters: {
    paddingTop: SdsSpacing.x8,
    paddingBottom: SdsSpacing.x6,
  },
  viewAll: {
    alignSelf: 'center',
    paddingVertical: SdsSpacing.x5,
  },
}));
