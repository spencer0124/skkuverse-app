import { useCallback } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { logHandledError } from '@/services/crashlytics';
import { AnonymousGate } from './components/AnonymousGate';
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
              type="2RowTypeA"
              top={t('notifications.noticesDetailSwitchLabel')}
              bottom={t('notifications.noticesDetailDesc')}
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
        <Txt typography="t5" fontWeight="regular" color={SdsColors.grey900}>
          {tab.label}
        </Txt>
      </View>
      <Switch
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: SdsColors.brand, false: undefined }}
      />
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
  },
  retryBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
});
