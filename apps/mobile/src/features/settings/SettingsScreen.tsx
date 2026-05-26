import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useSettingsStore, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';
import { logSettingsContentSelect } from '@/services/analytics';

export function SettingsScreen() {
  const router = useRouter();
  const { t } = useT();
  const developerMode = useSettingsStore((s) => s.developerMode);

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
        {/* Android Google Sign-In 12500 디버깅 토글. Android Alert을
            우회해 실제 sign-in 시도를 띄움 — 게이트 자체는 안 풀림. */}
        {Platform.OS === 'android' ? (
          <BadgeNavRow
            badge="🛠️"
            tossface
            title="개발자 모드"
            subtitle={developerMode ? '활성화됨' : 'Google 로그인 시도 허용'}
            onPress={() => {
              logSettingsContentSelect({
                content_type: 'row_developer_mode',
                item_id: 'developer_mode',
              });
              router.push('/settings/developer-mode' as never);
            }}
          />
        ) : null}
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
