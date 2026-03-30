/**
 * Status cards — displayed when schedule is not in 'active' state.
 *
 * SuspendedCard: shows resume date and message.
 * NoDataCard: shown when no schedule data available.
 * NoServiceCard: shown for days with no service.
 * ErrorCard: shown when API fails.
 *
 * Flutter source: bus_campus_screen.dart (status widgets)
 */

import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors } from '@skkuverse/shared';
import { Txt, Button } from '@skkuverse/sds';

interface StatusCardProps {
  icon: string;
  iconColor: string;
  title: string;
  subtitle?: string;
}

function StatusCard({ icon, iconColor, title, subtitle }: StatusCardProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons
        name={icon as keyof typeof MaterialIcons.glyphMap}
        size={40}
        color={iconColor}
      />
      <Txt typography="t5" fontWeight="semiBold" textAlign="center">
        {title}
      </Txt>
      {subtitle != null && (
        <Txt typography="t7" color={SdsColors.grey500} textAlign="center">
          {subtitle}
        </Txt>
      )}
    </View>
  );
}

interface SuspendedCardProps {
  resumeDate?: string;
  message?: string;
}

export function SuspendedCard({ resumeDate, message }: SuspendedCardProps) {
  return (
    <StatusCard
      icon="pause-circle-outline"
      iconColor={SdsColors.orange500}
      title="운행이 중단되었어요"
      subtitle={
        message ??
        (resumeDate ? `${resumeDate}부터 다시 운행할 예정이에요` : undefined)
      }
    />
  );
}

export function NoDataCard() {
  return (
    <StatusCard
      icon="info-outline"
      iconColor={SdsColors.grey400}
      title="시간표 정보가 없어요"
    />
  );
}

interface NoServiceCardProps {
  label?: string;
}

export function NoServiceCard({ label }: NoServiceCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{'\ud83d\ude8c'}</Text>
      <Txt typography="t5" fontWeight="semiBold" textAlign="center">
        운행하지 않아요
      </Txt>
      {label != null && (
        <Txt typography="t7" color={SdsColors.grey500} textAlign="center">
          {label}
        </Txt>
      )}
    </View>
  );
}

interface ErrorCardProps {
  onRetry?: () => void;
}

export function ErrorCard({ onRetry }: ErrorCardProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons
        name="error-outline"
        size={40}
        color={SdsColors.grey400}
      />
      <Txt typography="t5" fontWeight="semiBold" textAlign="center">
        데이터를 불러올 수 없어요
      </Txt>
      {onRetry ? (
        <Button type="primary" size="medium" onPress={onRetry} viewStyle={{ marginTop: 4 }}>
          다시 시도
        </Button>
      ) : (
        <Txt typography="t7" color={SdsColors.grey500} textAlign="center">
          잠시 후 다시 시도해주세요
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emoji: {
    fontSize: 40,
  },
});
