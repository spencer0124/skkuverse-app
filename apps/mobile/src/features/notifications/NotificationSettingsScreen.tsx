/**
 * Notification settings — main entry (v5 SSOT, Firestore-driven).
 *
 * Master toggle + 3 카테고리 BadgeNavRow (drill-in). 각 카테고리 detail 페이지에서
 * 세부 토글을 수행. 필수 카테고리는 항상 ON (UI lock + CF derive override + Rules block).
 *
 * 두 entry points:
 *   1. Settings 탭 → 알림
 *   2. NoticesTabScreen → bell icon (deeplink, deeper detail은 자체적으로 router.push)
 */

import { useCallback, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  BadgeNavRow,
  Button,
  Dialog,
  ListRow,
  Switch,
  Txt,
} from '@skkuverse/sds';
// Switch is still used by master toggle below; categories are drill-in only.
import {
  SdsColors,
  useAuthStore,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { setMasterEnabled } from '@/services/firestore-notifications';
import { checkPermission, requestPermission } from '@/services/messaging';
import { logHandledError } from '@/services/crashlytics';
import { AnonymousGate } from './components/AnonymousGate';
import { ScreenHeader } from './components/ScreenHeader';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const preferences = useNotificationStore((s) => s.preferences);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void checkPermission().then((status) => {
        if (!cancelled) setPermissionStatus(status);
      });
      return () => {
        cancelled = true;
      };
    }, [setPermissionStatus]),
  );

  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const handleToggleMaster = useCallback(
    async (next: boolean) => {
      if (!uid) return;
      if (next) {
        const status = await requestPermission();
        setPermissionStatus(status);
        if (status !== 'authorized' && status !== 'provisional') {
          setShowPermissionDialog(true);
          return;
        }
      }
      try {
        await setMasterEnabled(uid, next);
      } catch (err) {
        logHandledError('notifications/set-master', err);
      }
    },
    [uid, setPermissionStatus],
  );

  const masterEnabled = preferences.enabled;

  const authReady = !!uid && !isAnonymous;
  if (!authReady) return <AnonymousGate />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t('notifications.settings')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {appLanguage === 'zh' && (
          <View style={styles.hintBanner}>
            <Txt typography="t7" color={SdsColors.grey700}>
              {t('notifications.zhHint')}
            </Txt>
          </View>
        )}

        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={t('notifications.master')}
              bottom={t('notifications.masterDesc')}
            />
          }
          right={
            <Switch checked={masterEnabled} onCheckedChange={handleToggleMaster} />
          }
        />

        <View style={styles.categories}>
          <BadgeNavRow
            badge="🔒"
            tossface
            title={t('notifications.essential')}
            subtitle={t('notifications.essentialSubtitle')}
            onPress={() => router.push('/notifications/essential')}
          />
          <BadgeNavRow
            badge="⚙️"
            tossface
            title={t('notifications.services')}
            subtitle={t('notifications.servicesSubtitle')}
            onPress={() => router.push('/notifications/services')}
            disabled={!masterEnabled}
          />
          <BadgeNavRow
            badge="📢"
            tossface
            title={t('notifications.notices')}
            subtitle={t('notifications.noticesSubtitle')}
            onPress={() => router.push('/notifications/notices')}
            disabled={!masterEnabled}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Dialog.Confirm
        open={showPermissionDialog}
        description={
          permissionStatus === 'denied'
            ? t('notifications.permissionDeniedDesc')
            : t('notifications.permissionDenied')
        }
        onClose={() => setShowPermissionDialog(false)}
        leftButton={
          <Button
            type="dark"
            style="weak"
            size="medium"
            display="block"
            onPress={() => setShowPermissionDialog(false)}
          >
            {t('notifications.cancel')}
          </Button>
        }
        rightButton={
          <Button
            type="dark"
            size="medium"
            display="block"
            onPress={() => {
              setShowPermissionDialog(false);
              void openOsSettings();
            }}
          >
            {t('notifications.openSettings')}
          </Button>
        }
      />
    </View>
  );
}

async function openOsSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch (e) {
    if (__DEV__) console.warn('[notifications] openOsSettings failed:', e);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    paddingBottom: 32,
  },
  hintBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: SdsColors.grey50,
  },
  categories: {
    marginTop: 0,
  },
  bottomSpacer: {
    height: 80,
  },
});
