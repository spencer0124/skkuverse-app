import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ListHeader, ListRow, Switch } from '@skkuverse/sds';
import {
  SdsColors,
  useAuthStore,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { setCategoryEnabled } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';
import { AnonymousGate } from './components/AnonymousGate';
import { HintBanner } from './components/HintBanner';

export default function ServicesSettingsScreen() {
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const preferences = useNotificationStore((s) => s.preferences);

  const masterEnabled = preferences.enabled;
  const checked = preferences.categoryEnabled?.services ?? false;

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!uid) return;
      try {
        await setCategoryEnabled(uid, 'services', next);
      } catch (err) {
        logHandledError('notifications/set-category', err);
      }
    },
    [uid],
  );

  const authReady = !!uid && !isAnonymous;
  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!masterEnabled && <HintBanner message={t('notifications.masterOffHint')} />}

        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={t('notifications.servicesDetailSwitchLabel')}
              bottom={t('notifications.servicesDetailDesc')}
            />
          }
          right={
            <Switch
              checked={checked}
              onCheckedChange={handleToggle}
              disabled={!masterEnabled}
            />
          }
        />

        <View style={styles.section}>
          <ListHeader
            title={
              <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                {t('notifications.servicesIncludesTitle')}
              </ListHeader.TitleParagraph>
            }
          />
          <ListRow
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('notifications.servicesIncludes1')} />
            }
          />
          <ListRow
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('notifications.servicesIncludes2')} />
            }
          />
          <ListRow
            contents={
              <ListRow.Texts type="1RowTypeA" top={t('notifications.servicesIncludes3')} />
            }
          />
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
  section: {
    marginTop: 16,
  },
});
