import { Image, ScrollView } from 'react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefPoster } from '../notice-brief.types';

interface Props {
  posters: NoticeBriefPoster[];
  sourceUrl: string;
  onPress: () => void;
}

const POSTER_HEIGHT = 168;
const POSTER_FALLBACK_RATIO = 3 / 4;

export function NoticePosterStrip({ posters, sourceUrl, onPress }: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {posters.map((poster) => (
        <Pressable
          key={poster.url}
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('notices.brief.poster')}
          bg="neutralWeak"
          style={[styles.poster, { width: POSTER_HEIGHT * posterRatio(poster) }]}
        >
          {/* WHY: sent as Referer, which department servers check to block hotlinking. */}
          <Image
            source={{ uri: poster.url, headers: { Referer: sourceUrl } }}
            style={styles.image}
            resizeMode="cover"
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function posterRatio(poster: NoticeBriefPoster): number {
  return poster.width && poster.height ? poster.width / poster.height : POSTER_FALLBACK_RATIO;
}

const useStyles = createThemedStyles(() => ({
  strip: {
    paddingHorizontal: SdsSpacing.gutter,
    gap: SdsSpacing.x2,
  },
  poster: {
    height: POSTER_HEIGHT,
    borderRadius: SdsRadius.r3,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
}));
