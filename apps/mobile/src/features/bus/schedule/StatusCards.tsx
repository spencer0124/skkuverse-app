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
import { SdsColors, SdsTypo } from '@skkuuniverse/shared';

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
      <Text style={styles.title}>{title}</Text>
      {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
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
      <Text style={styles.emoji}>🚌</Text>
      <Text style={styles.title}>운행하지 않아요</Text>
      {label != null && <Text style={styles.subtitle}>{label}</Text>}
    </View>
  );
}

export function ErrorCard() {
  return (
    <StatusCard
      icon="error-outline"
      iconColor={SdsColors.red500}
      title="시간표를 불러올 수 없어요"
      subtitle="잠시 후 다시 시도해주세요"
    />
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
  title: {
    fontSize: SdsTypo.t5.fontSize,
    lineHeight: SdsTypo.t5.lineHeight,
    fontWeight: '600',
    color: SdsColors.grey900,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    color: SdsColors.grey500,
    textAlign: 'center',
  },
});
