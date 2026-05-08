import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';

export function SettingsScreen() {
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BadgeNavRow
          badge="👤"
          tossface
          title={t('settings.account')}
          subtitle={t('settings.accountSubtitle')}
          onPress={() => router.push('/settings/account' as never)}
        />
        <BadgeNavRow
          badge="🔔"
          tossface
          title={t('settings.notifications')}
          subtitle={t('settings.notificationsSubtitle')}
          onPress={() => router.push('/notifications/settings' as never)}
        />
        <BadgeNavRow
          badge="🐛"
          tossface
          title={t('settings.fcmDebug')}
          subtitle={t('settings.fcmDebugSubtitle')}
          onPress={() => router.push('/debug-fcm' as never)}
        />
        {/* RELEASE-GATE(debug-menu): 정식 App Store 출시 전 이 row 제거. 외부
            테스터 0명 가정. 본인 디바이스 진단 전용 — FCM 토큰 노출됨. */}
        <BadgeNavRow
          badge="📋"
          tossface
          title="디버깅 로그"
          subtitle="알림 탭 진단 (TestFlight)"
          onPress={() => router.push('/settings/debug-logs' as never)}
        />
        <BadgeNavRow
          badge="📜"
          tossface
          title={t('settings.licenses')}
          subtitle={t('settings.licensesSubtitle')}
          onPress={() => router.push('/settings/licenses' as never)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
});
