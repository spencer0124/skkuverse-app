import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';
import { logSettingsContentSelect } from '@/services/analytics';
import { openInAppBrowser } from '@/features/in-app-browser/open';
import { DEFAULT_BROWSER_URL } from '@/features/in-app-browser/protocol';

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
        {/* TODO: Remove — temporary food classification eval */}
        <TouchableOpacity
          style={devStyles.devButton}
          onPress={() => router.push('/debug-food-eval' as never)}
        >
          <Text style={devStyles.devButtonText}>🍔 Food Eval (dev only)</Text>
        </TouchableOpacity>
        {/* TODO: Remove — temporary local-LLM eval */}
        <TouchableOpacity
          style={[devStyles.devButton, devStyles.devButtonLlm]}
          onPress={() => router.push('/debug-local-llm' as never)}
        >
          <Text style={devStyles.devButtonText}>🦙 Local LLM (dev only)</Text>
        </TouchableOpacity>
        {/* TODO: Remove — temporary in-app browser eval (총학 공지 기본 URL) */}
        <TouchableOpacity
          style={[devStyles.devButton, devStyles.devButtonBrowser]}
          onPress={() => openInAppBrowser(DEFAULT_BROWSER_URL, '총학생회 공지')}
        >
          <Text style={devStyles.devButtonText}>🌐 인앱 브라우저 (dev only)</Text>
        </TouchableOpacity>
        {/* RELEASE-GATE(debug-menu): 출시 전 제거 — 상세 진단 로그 뷰어 */}
        <TouchableOpacity
          style={[devStyles.devButton, devStyles.devButtonLogs]}
          onPress={() => router.push('/settings/debug-logs' as never)}
        >
          <Text style={devStyles.devButtonText}>🪵 디버그 로그 (dev only)</Text>
        </TouchableOpacity>
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
  devButtonLlm: {
    marginTop: 12,
    backgroundColor: '#2a1a3a',
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
