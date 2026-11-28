import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Border, Pressable, TextButton, createThemedStyles } from '@skkuverse/sds';

interface Props {
  onPress: () => void;
}

export function NoticeViewAllButton({ onPress }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const label = t('notices.brief.viewAll');

  return (
    <>
      <Border variant="full" />
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} bg="layerDefault">
        {/* WHY: the whole box is the target, so the label inside must not take the touch as a second button. */}
        <View pointerEvents="none">
          <TextButton typography="t6" variant="arrow" color="neutralMuted" style={styles.label}>
            {label}
          </TextButton>
        </View>
      </Pressable>
    </>
  );
}

const useStyles = createThemedStyles(() => ({
  label: {
    alignSelf: 'center',
    paddingVertical: SdsSpacing.x5,
  },
}));
