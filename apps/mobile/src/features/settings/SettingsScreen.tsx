import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';
import { logSettingsContentSelect } from '@/services/analytics';

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
