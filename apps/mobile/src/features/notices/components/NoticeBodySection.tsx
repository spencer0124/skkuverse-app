import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';
import type { NoticeBriefAttachment } from '../notice-brief.types';
import { NoticeImageAttachments } from './NoticeImageAttachments';
import { NoticeViewAllButton } from './NoticeViewAllButton';

interface Props {
  images: NoticeBriefAttachment[];
  sourceUrl: string;
  onImagePress: () => void;
  onViewAll: (() => void) | null;
}

export function NoticeBodySection({ images, sourceUrl, onImagePress, onViewAll }: Props) {
  const styles = useStyles();

  return (
    <View>
      {images.length > 0 ? (
        <View style={styles.images}>
          <NoticeImageAttachments images={images} sourceUrl={sourceUrl} onPress={onImagePress} />
        </View>
      ) : null}
      {onViewAll ? <NoticeViewAllButton onPress={onViewAll} /> : null}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  images: {
    paddingTop: SdsSpacing.x6,
    paddingBottom: SdsSpacing.x4,
  },
}));
