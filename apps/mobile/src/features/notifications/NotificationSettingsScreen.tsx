/**
 * Notification settings — v5 SSOT (Firestore-driven, server-derived).
 *
 * Three category toggles + master toggle. Picker sub-row exposes the
 * user's subscribed departments and a deep entry into NoticePickerSheet
 * for editing. All UI state is read from `useNotificationStore.preferences`
 * which is itself fed by an onSnapshot listener — so changes from another
 * device propagate here automatically.
 *
 * Writes use the v5 thin wrappers: setMasterEnabled / setCategoryEnabled /
 * setPickerSelectionRemote. The CF onPreferencesWrite trigger derives
 * `subscribedTopics` server-side; clients never write derived fields
 * (Rules block it from Phase F onward).
 *
 * Two entry points to this screen (Toss pattern):
 *   1. Settings tab → 알림 (global)
 *   2. NoticesTabScreen → bell icon (deeplink to here, no separate sheet)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Button, Dialog, ListRow, Switch, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  SdsSpacing,
  resolvePickerSelection,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useSettingsStore,
  useT,
  type NoticeTab,
  type TranslationKey,
} from '@skkuverse/shared';
import {
  setCategoryEnabled,
  setMasterEnabled,
  setNoticeTabEnabled,
  setPickerSelectionRemote,
} from '@/services/firestore-notifications';
import {
  checkPermission,
  requestPermission,
} from '@/services/messaging';
import { logHandledError } from '@/services/crashlytics';
import { NoticePickerSheet } from '@/features/notices/NoticePickerSheet';

const DEPT_TAB_KEY = 'dept';

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

  const authReady = !!uid && !isAnonymous;

  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();

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
  const sheetRef = useRef<BottomSheetModal>(null);

  const handleToggleMaster = useCallback(
    async (nextValue: boolean) => {
      if (!uid) return;
      if (nextValue) {
        const status = await requestPermission();
        setPermissionStatus(status);
        if (status !== 'authorized' && status !== 'provisional') {
          setShowPermissionDialog(true);
          return;
        }
      }
      try {
        await setMasterEnabled(uid, nextValue);
      } catch (err) {
        logHandledError('notifications/set-master', err);
      }
    },
    [uid, setPermissionStatus],
  );

  const handleToggleCategory = useCallback(
    async (key: 'essential' | 'services' | 'notices', nextValue: boolean) => {
      if (!uid) return;
      try {
        await setCategoryEnabled(uid, key, nextValue);
      } catch (err) {
        logHandledError('notifications/set-category', err);
      }
    },
    [uid],
  );

  const handleToggleNoticeTab = useCallback(
    async (tabKey: string, nextValue: boolean) => {
      if (!uid) return;
      try {
        await setNoticeTabEnabled(uid, tabKey, nextValue);
      } catch (err) {
        logHandledError('notifications/set-notice-tab', err);
      }
    },
    [uid],
  );

  // Per-tab on/off — undefined defaults to ON to match derive() contract.
  const isNoticeTabOn = useCallback(
    (key: string): boolean =>
      preferences.noticeTabEnabled?.[key] !== false,
    [preferences.noticeTabEnabled],
  );

  // ── Dept picker sheet ─────────────────────────────────────────────
  const deptTab = useMemo<NoticeTab | undefined>(
    () => tabsConfig?.tabs.find((tab) => tab.key === DEPT_TAB_KEY),
    [tabsConfig],
  );

  const subscribedDeptIds = useMemo(
    () =>
      deptTab
        ? resolvePickerSelection(
            deptTab,
            preferences.pickerSelections?.[DEPT_TAB_KEY],
          )
        : [],
    [deptTab, preferences.pickerSelections],
  );

  const subscribedDeptNames = useMemo(() => {
    if (!deptTab?.picker) return [];
    const map = new Map(
      deptTab.picker.departments.map((d) => [d.id, d.name]),
    );
    return subscribedDeptIds.map((id) => map.get(id) ?? id);
  }, [deptTab, subscribedDeptIds]);

  const openDeptPicker = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const handlePickerConfirm = useCallback(
    async (newIds: string[]) => {
      if (!uid) return;
      try {
        await setPickerSelectionRemote(uid, DEPT_TAB_KEY, newIds);
      } catch (err) {
        logHandledError('notifications/set-picker', err);
      }
    },
    [uid],
  );

  const masterOff = !preferences.enabled;
  const categoryDisabled = masterOff;
  const noticesEnabled = preferences.categoryEnabled?.notices === true;

  if (!authReady) {
    return (
      <AnonymousGate
        onLoginPress={() => router.replace('/login')}
        onClose={() => router.back()}
        t={t}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('notifications.settings')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {appLanguage === 'zh' && (
          <View style={styles.hintBanner}>
            <Txt typography="t7" color={SdsColors.grey700}>
              {t('notifications.zhHint')}
            </Txt>
          </View>
        )}

        {/* Master toggle */}
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={t('notifications.master')}
              bottom={t('notifications.masterDesc')}
            />
          }
          right={
            <Switch
              checked={preferences.enabled}
              onCheckedChange={handleToggleMaster}
            />
          }
        />

        {/* Three categories */}
        <CategoryRow
          label={t('notifications.essential')}
          checked={preferences.categoryEnabled?.essential ?? false}
          disabled={categoryDisabled}
          onToggle={(v) => handleToggleCategory('essential', v)}
        />
        <CategoryRow
          label={t('notifications.services')}
          checked={preferences.categoryEnabled?.services ?? false}
          disabled={categoryDisabled}
          onToggle={(v) => handleToggleCategory('services', v)}
        />
        <CategoryRow
          label={t('notifications.notices')}
          checked={noticesEnabled}
          disabled={categoryDisabled}
          onToggle={(v) => handleToggleCategory('notices', v)}
        />

        {/* Notices sub-section: per-tab toggles in server order, plus the
            dept picker sub-row inline beneath the dept tab when ON. */}
        {noticesEnabled && tabsConfig?.tabs.length ? (
          <View style={[styles.subSection, categoryDisabled && styles.disabledOpacity]}>
            {tabsConfig.tabs.map((tab) => {
              const tabOn = isNoticeTabOn(tab.key);
              const showDeptPicker =
                tab.key === DEPT_TAB_KEY && tabOn && deptTab?.picker;
              return (
                <View key={tab.key}>
                  <ListRow
                    contents={<ListRow.Texts type="1RowTypeA" top={tab.label} />}
                    right={
                      <Switch
                        checked={tabOn}
                        onCheckedChange={(v) => handleToggleNoticeTab(tab.key, v)}
                        disabled={categoryDisabled}
                      />
                    }
                  />
                  {showDeptPicker && (
                    <View style={styles.deptPickerWrap}>
                      <Txt
                        typography="t7"
                        color={SdsColors.grey600}
                        style={styles.subSectionLabel}
                      >
                        {t('notifications.subscribedDepts')}
                      </Txt>
                      {subscribedDeptNames.map((name, idx) => (
                        <View key={`${name}-${idx}`} style={styles.subRow}>
                          <Txt typography="t6" color={SdsColors.grey900}>
                            • {name}
                          </Txt>
                        </View>
                      ))}
                      <Pressable
                        onPress={openDeptPicker}
                        disabled={categoryDisabled}
                        style={({ pressed }) => [
                          styles.editRow,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Txt typography="t6" color={SdsColors.grey900}>
                          {t('notifications.editDept')}
                        </Txt>
                        <ChevronRight size={20} color={SdsColors.grey600} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

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

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Picker sheet — bound to dept tab for the Settings entry */}
      {deptTab?.picker && (
        <NoticePickerSheet
          ref={sheetRef}
          items={deptTab.picker.departments}
          selectedIds={subscribedDeptIds}
          maxSelection={deptTab.picker.maxSelection}
          onConfirm={handlePickerConfirm}
          title={deptTab.label}
        />
      )}

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

// ── Sub-components ──────────────────────────────────────────────────

function CategoryRow({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <View style={[styles.section, disabled && styles.disabledOpacity]}>
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top={label} />}
        right={
          <Switch
            checked={checked}
            onCheckedChange={onToggle}
            disabled={disabled}
          />
        }
      />
    </View>
  );
}

function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        hitSlop={12}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={24} color={SdsColors.grey900} />
      </Pressable>
      <View style={styles.headerTitleWrap}>
        <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
          {title}
        </Txt>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function AnonymousGate({
  onLoginPress,
  onClose,
  t,
}: {
  onLoginPress: () => void;
  onClose: () => void;
  t: (k: TranslationKey) => string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t('notifications.settings')} onBack={onClose} />
      <View style={styles.gateBody}>
        <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
          {t('notifications.loginRequired')}
        </Txt>
        <View style={{ height: SdsSpacing.lg }} />
        <Button type="primary" size="medium" display="block" onPress={onLoginPress}>
          {t('notifications.loginCta')}
        </Button>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  scrollContent: {
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
  section: {
    marginTop: 8,
  },
  disabledOpacity: {
    opacity: 0.4,
  },
  subSection: {
    marginTop: 4,
    paddingLeft: SdsSpacing.lg,
  },
  deptPickerWrap: {
    paddingLeft: SdsSpacing.lg,
    paddingVertical: SdsSpacing.sm,
    gap: SdsSpacing.xs,
  },
  subSectionLabel: {
    paddingTop: SdsSpacing.xs,
    paddingBottom: SdsSpacing.xs,
  },
  subRow: {
    paddingVertical: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SdsSpacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  retryBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  bottomSpacer: {
    height: 80,
  },
  gateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});
