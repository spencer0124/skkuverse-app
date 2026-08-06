import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';
import { logSettingsContentSelect } from '@/services/analytics';
import * as Updates from 'expo-updates';

export function SettingsScreen() {
  const router = useRouter();
  const { t } = useT();

  // 진단/eval 진입(dev only 메뉴)은 dev 빌드 + beta(TestFlight)에서만 노출하고
  // production(App Store) 릴리즈에선 숨긴다. __DEV__는 TestFlight에서도 false이므로
  // 실기기 ANE 테스트·디버그 로그 확인을 위해 beta 채널을 함께 허용한다.
  const showDevMenu = __DEV__ || Updates.channel === 'beta';

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
          onPress={() => {
            logSettingsContentSelect({ content_type: 'row_account', item_id: 'account' });
            router.push('/settings/account' as never);
          }}
        />
        <BadgeNavRow
          badge="🔔"
          tossface
          title={t('settings.notifications')}
          subtitle={t('settings.notificationsSubtitle')}
          onPress={() => {
            logSettingsContentSelect({ content_type: 'row_notifications', item_id: 'settings' });
            router.push('/notifications/settings' as never);
          }}
        />
        <BadgeNavRow
          badge="💬"
          tossface
          title={t('settings.contact.title')}
          subtitle={t('settings.contact.subtitle')}
          onPress={() => {
            logSettingsContentSelect({ content_type: 'row_kakao', item_id: 'channel' });
            handleSduiAction({
              actionType: 'external',
              actionValue: 'https://pf.kakao.com/_cjxexdG/chat',
            });
          }}
        />
        {/* dev/eval 진입 — production(App Store) 릴리즈에선 숨김 (dev + beta/TestFlight만 노출) */}
        {showDevMenu && (
          <>
            {/* RELEASE-GATE(debug-menu): 출시 전 제거 — 상세 진단 로그 뷰어 */}
            <TouchableOpacity
              style={[devStyles.devButton, devStyles.devButtonLogs]}
              onPress={() => router.push('/settings/debug-logs' as never)}
            >
              <Text style={devStyles.devButtonText}>🪵 디버그 로그 (dev only)</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const devStyles = StyleSheet.create({
  devButton: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: '#1a3a1a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devButtonBrowser: {
    marginTop: 12,
    backgroundColor: '#1a2a3a',
  },
  devButtonLogs: {
    marginTop: 12,
    backgroundColor: '#3a2a1a',
  },
  devButtonText: { color: '#4caf50', fontSize: 14, fontWeight: '600' },
});

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
