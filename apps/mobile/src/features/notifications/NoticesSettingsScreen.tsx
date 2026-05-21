import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button, ListRow, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useT,
  type NoticeTab,
} from '@skkuverse/shared';
import {
  setCategoryEnabled,
  setNoticeTabEnabled,
} from '@/services/firestore-notifications';
import { checkPermission } from '@/services/messaging';
import { logHandledError } from '@/services/crashlytics';
import { AnonymousGate } from './components/AnonymousGate';
import { EnableNotificationsSheet } from './components/EnableNotificationsSheet';
import { HintBanner } from './components/HintBanner';

// 9탭 key → Tossface 이모지 매핑.
// CLAUDE.md tabsContract 의 9개 key 와 일치 (dept/academic/scholarship/career/
// recruitment/event/library/dorm/general). server 가 새 탭 추가 시 fallback 으로
// 📌 가 표시되므로 즉시 깨지진 않지만 동기화 필요.
const TAB_EMOJI: Record<string, string> = {
  dept: '🎓',
  academic: '📖',
  scholarship: '💰',
  career: '💼',
  recruitment: '📣',
  event: '🎉',
  library: '📚',
  dorm: '🛏️',
  general: '📌',
};

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

interface TabToggleRowProps {
  tab: NoticeTab;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}

function TabToggleRow({ tab, checked, onChange, disabled }: TabToggleRowProps) {
  const emoji = TAB_EMOJI[tab.key] ?? '📌';
  return (
    <View style={styles.tabRow}>
      <View style={styles.badge}>
        <Text style={styles.badgeEmoji}>{emoji}</Text>
      </View>
      <View style={styles.tabTitleWrap}>
        <Txt
          typography="t5"
          fontWeight="regular"
          color={SdsColors.grey900}
          style={styles.tabTitleText}
        >
          {tab.label}
        </Txt>
      </View>
      <View style={styles.switchWrap}>
        <Switch
          value={checked}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: SdsColors.brand, false: undefined }}
        />
      </View>
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
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 22,
    lineHeight: 28,
  },
  tabTitleWrap: {
    flex: 1,
    marginLeft: 16,
    // Fixed envelope matching the badge (40) and switchWrap so all three
    // share an identical vertical container under alignItems:'center'.
    height: 40,
    justifyContent: 'center',
  },
  tabTitleText: {
    // RN iOS Text+Switch baseline mismatch is structural: alignItems:'center'
    // centers layout boxes, not glyphs. Direct lineHeight collapse triggers
    // RN bug facebook/react-native#29507 (leading removed only from above
    // when lineHeight <= fontSize), so we keep t5's default 25.5 lineHeight
    // and instead let verticalAlign:'middle' (RN 0.74+) center the glyph
    // within its line-box. Combined with the fixed-height tabTitleWrap +
    // switchWrap envelopes, the row's alignItems:'center' lines up the
    // glyph center with the Switch's visual center.
    verticalAlign: 'middle',
  },
  switchWrap: {
    // Mirrors tabTitleWrap's vertical envelope so the row's alignItems:
    // 'center' lines up Switch and label at the same Y, removing the
    // single-line baseline drift that 2-row master ListRow happens to
    // avoid by accident (Switch sits between two text lines).
    height: 40,
    justifyContent: 'center',
  },
  retryBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
});
