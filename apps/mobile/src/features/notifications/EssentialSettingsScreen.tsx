import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ListRow, Switch, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  SdsSpacing,
  useAuthStore,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { AnonymousGate } from './components/AnonymousGate';
import { HintBanner } from './components/HintBanner';
import { ScreenHeader } from './components/ScreenHeader';

export default function EssentialSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const masterEnabled = useNotificationStore((s) => s.preferences.enabled);

  const authReady = !!uid && !isAnonymous;
  if (!authReady) return <AnonymousGate />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t('notifications.essential')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!masterEnabled && <HintBanner message={t('notifications.masterOffHint')} />}

        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={t('notifications.essentialDetailSwitchLabel')}
              bottom={t('notifications.essentialDetailDesc')}
            />
          }
          right={<Switch checked={true} disabled={true} onCheckedChange={() => {}} />}
        />

        <View style={styles.infoCard}>
          <Txt typography="t6" fontWeight="bold" color={SdsColors.grey900}>
            {t('notifications.essentialLockedTitle')}
          </Txt>
          <View style={{ height: SdsSpacing.xs }} />
          <Txt typography="t7" color={SdsColors.grey700}>
            {t('notifications.essentialLockedBody')}
          </Txt>
        </View>
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
    paddingBottom: 32,
  },
  infoCard: {
    marginTop: SdsSpacing.lg,
    marginHorizontal: 16,
    padding: SdsSpacing.lg,
    borderRadius: 12,
    backgroundColor: SdsColors.grey50,
  },
});
