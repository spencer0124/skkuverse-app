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
import { CirclePause, Info, CircleAlert } from 'lucide-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt, Button } from '@skkuverse/sds';
import type { ReactNode } from 'react';

interface StatusCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

function StatusCard({ icon, title, subtitle }: StatusCardProps) {
  return (
    <View style={styles.container}>
      {icon}
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
  const { t, tpl } = useT();
  return (
    <StatusCard
      icon={<CirclePause size={40} color={SdsColors.orange500} />}
      title={t('schedule.suspended')}
      subtitle={
        message ??
        (resumeDate ? tpl('schedule.resumeDate', resumeDate) : undefined)
      }
    />
  );
}

export function NoDataCard() {
  const { t } = useT();
  return (
    <StatusCard
      icon={<Info size={40} color={SdsColors.grey400} />}
      title={t('schedule.noScheduleData')}
    />
  );
}

interface NoServiceCardProps {
  label?: string;
}

export function NoServiceCard({ label }: NoServiceCardProps) {
  const { t } = useT();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{'\ud83d\ude8c'}</Text>
      <Txt typography="t5" fontWeight="semiBold" textAlign="center">
        {t('transit.noService')}
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
  const { t } = useT();
  return (
    <View style={styles.container}>
      <CircleAlert size={40} color={SdsColors.grey400} />
      <Txt typography="t5" fontWeight="semiBold" textAlign="center">
        {t('schedule.dataLoadFailed')}
      </Txt>
      {onRetry ? (
        <Button type="primary" size="medium" onPress={onRetry} viewStyle={{ marginTop: 4 }}>
          {t('common.retry')}
        </Button>
      ) : (
        <Txt typography="t7" color={SdsColors.grey500} textAlign="center">
          {t('error.tryLater')}
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
    fontFamily: 'TossFaceFontMac',
    fontSize: 40,
  },
});
