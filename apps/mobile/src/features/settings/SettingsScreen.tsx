import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';

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
          badge="💬"
          tossface
          title="문의하기"
          subtitle="카카오톡 채널로 연결"
          onPress={() =>
            handleSduiAction({
              actionType: 'external',
              actionValue: 'https://pf.kakao.com/_cjxexdG/chat',
            })
          }
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
