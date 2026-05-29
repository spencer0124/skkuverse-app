import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button, ListRow, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import {
  setCategoryEnabled,
  setNoticeTabEnabled,
} from '@/services/firestore-notifications';
import { checkPermission } from '@/services/messaging';
import { logHandledError } from '@/services/crashlytics';
import { logNotificationTabToggle } from '@/services/analytics';
import { AnonymousGate } from './components/AnonymousGate';
import { EnableNotificationsSheet } from './components/EnableNotificationsSheet';
import { HintBanner } from './components/HintBanner';
import { TabToggleRow } from './components/TabToggleRow';

export default function NoticesSettingsScreen() {
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const preferences = useNotificationStore((s) => s.preferences);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const enableSheetDismissed = useNotificationStore(
    (s) => s.enableSheetDismissedThisSession,
  );

  // NotificationSettingsScreen과 동일 패턴: focus 시 OS truth fetch → store mirror.
  // 사용자가 OS 설정에서 권한 변경 후 돌아오면 fresh status 반영되어 self-heal.
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

  // Auto-present enable sheet when permission isn't granted — 공지 탭 bell icon
  // 으로 들어온 사용자도 NotificationSettingsScreen과 동일하게 권한 유도 받음.
  // enableSheetDismissedThisSession은 store에서 session-scoped라 두 screen 간
  // dismissal intent 공유 (한 번 닫으면 같은 세션엔 다른 screen에서도 안 뜸).
  const enableSheetRef = useRef<BottomSheetModal>(null);
  useEffect(() => {
    const notGranted =
      permissionStatus === 'denied' || permissionStatus === 'notDetermined';
    if (notGranted && !enableSheetDismissed) {
      enableSheetRef.current?.present();
    }
  }, [permissionStatus, enableSheetDismissed]);

  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();

  const masterEnabled = preferences.enabled;
  const noticesEnabled = preferences.categoryEnabled?.notices === true;
  const togglesDisabled = !masterEnabled;

  const handleToggleCategory = useCallback(
    async (next: boolean) => {
      if (!uid) return;
      try {
        await setCategoryEnabled(uid, 'notices', next);
      } catch (err) {
        logHandledError('notifications/set-category', err);
      }
    },
    [uid],
  );

  const handleToggleNoticeTab = useCallback(
    async (tabKey: string, next: boolean) => {
      if (!uid) return;
      logNotificationTabToggle({ tab_key: tabKey, enabled: next, source: 'settings' });
      try {
        await setNoticeTabEnabled(uid, tabKey, next);
      } catch (err) {
        logHandledError('notifications/set-notice-tab', err);
      }
    },
    [uid],
  );

  // undefined → default ON (matches CF derive contract).
  const isNoticeTabOn = useCallback(
    (key: string): boolean => preferences.noticeTabEnabled?.[key] !== false,
    [preferences.noticeTabEnabled],
  );

  const authReady = !!uid && !isAnonymous;
  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!masterEnabled && <HintBanner message={t('notifications.masterOffHint')} />}
        {masterEnabled && !noticesEnabled && (
          <HintBanner message={t('notifications.noticesCategoryOffHint')} />
        )}

        <ListRow
          contents={
            <ListRow.Texts
              type="1RowTypeA"
              top={t('notifications.noticesDetailSwitchLabel')}
            />
          }
          right={
            <Switch
              value={noticesEnabled}
              onValueChange={handleToggleCategory}
              disabled={togglesDisabled}
              trackColor={{ true: SdsColors.brand, false: undefined }}
            />
          }
        />

        {tabsConfig?.tabs.map((tab) => (
          <TabToggleRow
            key={tab.key}
            tab={tab}
            checked={isNoticeTabOn(tab.key)}
            onChange={(v) => handleToggleNoticeTab(tab.key, v)}
            disabled={togglesDisabled}
          />
        ))}

        {tabsError && !tabsLoading && (
          <View style={styles.retryBlock}>
            <Txt typography="t6" color={SdsColors.grey600}>
              {t('notifications.loadError')}
            </Txt>
            <Button
              type="dark"
              style="weak"
              size="tiny"
              onPress={() => refetchTabs()}
            >
              {t('notifications.retry')}
            </Button>
          </View>
        )}
      </ScrollView>

      <EnableNotificationsSheet ref={enableSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    paddingBottom: 80,
  },
  retryBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
});
