import { useWindowDimensions, View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';
import { buildAttachmentUrl } from '../attachment.rules';
import type { NoticeBriefAttachment } from '../notice-brief.types';
import { RefererImage } from './RefererImage';

interface Props {
  images: NoticeBriefAttachment[];
  sourceUrl: string;
  onPress: () => void;
}

export function NoticeImageAttachments({ images, sourceUrl, onPress }: Props) {
  const styles = useStyles();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.wrap}>
      {images.map((image) => (
        <RefererImage
          key={image.url}
          uri={buildAttachmentUrl(image.url, sourceUrl, 'inline', image.name)}
          alt={image.name}
          containerWidth={width - SdsSpacing.gutter * 2}
          sizing="fill"
          failure="hidden"
          onPress={onPress}
        />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  wrap: {
    paddingHorizontal: SdsSpacing.gutter,
  },
}));
