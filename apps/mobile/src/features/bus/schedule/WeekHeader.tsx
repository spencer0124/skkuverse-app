/**
 * Week header — Korean week label with prev/next navigation arrows.
 *
 * Design source: shuttle-v3.html (.week-header)
 */

import { View, Pressable, StyleSheet } from 'react-native';
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { logBusContentSelect } from '@/services/analytics';

interface WeekHeaderProps {
  label: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function WeekHeader({ label, canGoPrev, canGoNext, onPrev, onNext }: WeekHeaderProps) {
  return (
    <View style={styles.container}>
      <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600}>
        {label}
      </Txt>
      <View style={styles.nav}>
        <Pressable
          onPress={() => {
            logBusContentSelect({ content_type: 'schedule_week_prev', item_id: label });
            onPrev();
          }}
          disabled={!canGoPrev}
          style={styles.button}
          hitSlop={4}
        >
          <CaretLeftIcon
            size={18}
            color={canGoPrev ? SdsColors.grey500 : SdsColors.grey300}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            logBusContentSelect({ content_type: 'schedule_week_next', item_id: label });
            onNext();
          }}
          disabled={!canGoNext}
          style={styles.button}
          hitSlop={4}
        >
          <CaretRightIcon
            size={18}
            color={canGoNext ? SdsColors.grey500 : SdsColors.grey300}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  nav: {
    flexDirection: 'row',
    gap: 2,
  },
  button: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
