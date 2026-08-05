import { View, StyleSheet, Pressable } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface Props {
  message: string;
  onRetry?: () => void;
  /**
   * Recovery CTA, kept separate from `onRetry` because they mean different
   * things: retry re-runs the same failed request, whereas this widens or
   * changes what's being asked (e.g. "전체 공지에서 찾아보기" after a
   * tab-scoped search comes back empty). A dead-end zero-result page is one of
   * the most common site-search failures, and the fix is always to offer the
   * next query rather than just report the absence.
   */
  actionLabel?: string;
  onAction?: () => void;
}

export function NoticeEmptyState({
  message,
  onRetry,
  actionLabel,
  onAction,
}: Props) {
  const { t } = useT();
  return (
    <View style={styles.container}>
      <Txt typography="t6" color={SdsColors.grey500}>
        {message}
      </Txt>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          <Txt typography="t6" fontWeight="semibold" color={SdsColors.background}>
            {actionLabel}
          </Txt>
        </Pressable>
      ) : null}
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
  // Filled rather than grey: this is the suggested next step, not a neutral
  // escape hatch like retry.
  action: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SdsColors.grey800,
  },
});
