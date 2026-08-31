/**
 * Notification settings — main entry (v5 SSOT, Firestore-driven).
 *
 * 공지 카테고리 drill-in 한 줄만 노출. 마스터 kill-switch 토글은 제거됨 —
 * 현재 사용자 노출 카테고리가 공지 하나뿐이라 마스터 ON/OFF가 공지 단위
 * 토글과 의미상 중복이었기 때문. 데이터 필드 `preferences.enabled`는 SSOT
 * 계약상 그대로 유지하되, 진입 시 false면 silently true로 복구해 레거시
 * `false` 상태 유저가 알림을 영영 못 받는 일을 막는다. 권한 grant 경로는
 * EnableNotificationsSheet가 이미 master=true로 플립하므로 그쪽과는 idempotent.
 *
 * 두 entry points:
 *   1. Settings 탭 → 알림
 *   2. NoticesTabScreen → bell icon (deeplink)
 */

import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { BadgeNavRow, Txt, type SheetRef } from '@skkuverse/sds';
import {
  SdsColors,
  useAuthStore,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { setMasterEnabled } from '@/services/firestore-notifications';
import { checkPermission } from '@/services/messaging';
import { logHandledError } from '@/services/crashlytics';
import { AnonymousGate } from './components/AnonymousGate';
import { EnableNotificationsSheet } from './components/EnableNotificationsSheet';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const preferences = useNotificationStore((s) => s.preferences);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const enableSheetDismissed = useNotificationStore(
    (s) => s.enableSheetDismissedThisSession,
  );

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

  // Auto-restore: 마스터 토글 UI가 제거됐으므로 `enabled=false` 상태로
  // 남은 레거시 유저는 sheet 경로(권한 grant 시 자동 true)로도 닿지 않는
  // "권한 OK + enabled false" 사각지대에 빠진다. 진입 시 한 번 true로
  // 끌어올린다. 이미 true면 no-op이라 idempotent.
  useEffect(() => {
    if (!uid) return;
    if (preferences.enabled === false) {
      setMasterEnabled(uid, true).catch((err) => {
        logHandledError('notifications/auto-restore-master', err);
      });
    }
  }, [uid, preferences.enabled]);

  // Proactively prompt users who could be receiving notifications but aren't.
  // Re-runs when permissionStatus refreshes (via useFocusEffect's checkPermission)
  // so externally-revoked permissions surface the sheet on the next status pull.
  // BottomSheetModal.present() is idempotent if already shown.
  const enableSheetRef = useRef<SheetRef>(null);
  useEffect(() => {
    const notGranted =
      permissionStatus === 'denied' || permissionStatus === 'notDetermined';
    if (notGranted && !enableSheetDismissed) {
      enableSheetRef.current?.present?.();
    }
  }, [permissionStatus, enableSheetDismissed]);

  const authReady = !!uid && !isAnonymous;
  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {appLanguage === 'zh' && (
          <View style={styles.hintBanner}>
            <Txt typography="t7" color={SdsColors.grey700}>
              {t('notifications.zhHint')}
            </Txt>
          </View>
        )}

        <View style={styles.categories}>
          <BadgeNavRow
            badge="📢"
            tossface
            title={t('notifications.notices')}
            subtitle={t('notifications.noticesSubtitle')}
            onPress={() => router.push('/notifications/notices')}
          />
        </View>

        <View style={styles.bottomSpacer} />
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
