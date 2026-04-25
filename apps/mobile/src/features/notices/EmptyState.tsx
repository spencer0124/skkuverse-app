import { View, StyleSheet, Pressable } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function NoticeEmptyState({ message, onRetry }: Props) {
  const { t } = useT();
  return (
    <View style={styles.container}>
      <Txt typography="t6" color={SdsColors.grey500}>
        {message}
      </Txt>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retry}>
          <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
            {t('notices.retry')}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
  },
});
