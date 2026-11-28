import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Border, TextButton, createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefAttachment } from '../notice-brief.types';
import { NoticeImageAttachments } from './NoticeImageAttachments';

interface Props {
  images: NoticeBriefAttachment[];
  sourceUrl: string;
  onImagePress: () => void;
  onViewAll: (() => void) | null;
}

export function NoticeBodySection({ images, sourceUrl, onImagePress, onViewAll }: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View>
      {images.length > 0 ? (
        <View style={styles.images}>
          <NoticeImageAttachments images={images} sourceUrl={sourceUrl} onPress={onImagePress} />
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
  images: {
    paddingTop: SdsSpacing.x6,
    paddingBottom: SdsSpacing.x4,
  },
  viewAll: {
    alignSelf: 'center',
    paddingVertical: SdsSpacing.x5,
  },
}));
