/**
 * Notification settings screen (Phase 3).
 *
 * Structure:
 *  - Master toggle (preferences.enabled + OS permission request on ON)
 *  - Category section (fixed notice tabs → category:{tabKey})
 *  - Department section (picker tabs → dept:{deptId}, only user's current selections)
 *  - zh locale hint banner (P1-8) when appLanguage === 'zh'
 *  - Anonymous gate — redirects to login (uid is required to edit preferences)
 *
 * Writes are optimistic at the UI layer and awaited inline in the handler.
 * We deliberately do NOT debounce — the prior debounce orphaned the write
 * promise across screen unmounts and the Firestore write stream stalled until
 * next app launch. Firestore onSnapshot keeps localPrefs consistent with the
 * server value once it lands.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChevronLeft } from 'lucide-react-native';
import {
  Button,
  Dialog,
  ListHeader,
  ListRow,
  Switch,
  Txt,
} from '@skkuverse/sds';
import {
  MANDATORY_TOPICS,
  SdsColors,
  SdsSpacing,
  buildTopic,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useSettingsStore,
  useT,
  type NoticeTab,
  type PreferencesDocument,
  type TranslationKey,
} from '@skkuverse/shared';
import { updatePreferences } from '@/services/firestore-notifications';
import {
  checkPermission,
  requestPermission,
} from '@/services/messaging';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { logHandledError } from '@/services/crashlytics';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const pickerSelections = useSettingsStore((s) => s.pickerSelections);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);

  const authReady = !!uid && !isAnonymous;

  const { prefs, loading: prefsLoading } = useNotificationPreferences(
    authReady ? uid : null,
  );
  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();

  // ── Optimistic local state (Firestore onSnapshot mirrors into this) ──
  const [localPrefs, setLocalPrefs] = useState<PreferencesDocument>({
    enabled: false,
    subscribedTopics: [...MANDATORY_TOPICS],
  });

  useEffect(() => {
    if (prefs) setLocalPrefs(prefs);
  }, [prefs]);

  // ── Inline Firestore write ──
  //
  // Earlier revisions used a 500ms debounce + fire-and-forget write on unmount.
  // That created an orphan-promise race: the write was enqueued in Firestore's
  // mutation queue but the SDK's write stream stalled because no JS-level
  // awaiter held the promise chain across screen teardown. The mutation only
  // flushed on next app cold start (see firebase-js-sdk #6515, #3816).
  //
  // Fix: each toggle awaits updatePreferences inline from its handler. Writes
  // are idempotent (full payload replace), so rapid toggles safely converge.
  // The original debounce motive ("avoid syncPreferencesToDevices Cloud
  // Function thrash") is moot — that function isn't deployed.
  const writeAndLog = useCallback(
    async (next: PreferencesDocument) => {
      if (!uid) return;
      try {
        await updatePreferences(uid, next);
      } catch (err) {
        logHandledError('notifications/update-preferences', err);
      }
    },
    [uid],
  );

  // ── P1-5: refresh permission state when screen regains focus ──
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

  // ── Toggle handlers ──
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const handleToggleMaster = useCallback(
    async (nextValue: boolean) => {
      if (!uid) return;

      if (nextValue) {
        // Ask OS for permission (idempotent on iOS).
        const status = await requestPermission();
        setPermissionStatus(status);
        if (status !== 'authorized' && status !== 'provisional') {
          setShowPermissionDialog(true);
          return;
        }
        const next: PreferencesDocument = {
          ...localPrefs,
          enabled: true,
        };
        setLocalPrefs(next);
        await writeAndLog(next);
      } else {
        // Keep subscribedTopics intact so re-enabling restores them.
        const next: PreferencesDocument = {
          ...localPrefs,
          enabled: false,
        };
        setLocalPrefs(next);
        await writeAndLog(next);
      }
    },
    [uid, localPrefs, writeAndLog, setPermissionStatus],
  );

  const handleToggleTopic = useCallback(
    async (topic: string, nextValue: boolean) => {
      if (MANDATORY_TOPICS.includes(topic)) return; // defense in depth
      if (!uid) return;
      const currentSet = new Set(localPrefs.subscribedTopics);
      if (nextValue) {
        currentSet.add(topic);
      } else {
        currentSet.delete(topic);
      }
      const next: PreferencesDocument = {
        enabled: localPrefs.enabled,
        subscribedTopics: [...currentSet],
      };
      setLocalPrefs(next);
      await writeAndLog(next);
    },
    [uid, localPrefs, writeAndLog],
  );

  const isSubscribed = useCallback(
    (topic: string) => localPrefs.subscribedTopics.includes(topic),
    [localPrefs.subscribedTopics],
  );

  // ── Tab-driven rows ──
  const tabs: NoticeTab[] = useMemo(() => tabsConfig?.tabs ?? [], [tabsConfig]);
  const fixedTabs = useMemo(() => tabs.filter((x) => x.tabMode === 'fixed'), [tabs]);
  const pickerTabs = useMemo(() => tabs.filter((x) => x.tabMode === 'picker'), [tabs]);

  const masterOff = !localPrefs.enabled;
  const subsectionsDisabled = masterOff || prefsLoading;

  // ── Early returns ──

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
      <ScreenHeader title={t('notifications.settings')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* zh hint banner */}
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
              checked={localPrefs.enabled}
              onCheckedChange={handleToggleMaster}
              disabled={prefsLoading}
            />
          }
        />

        {/* Categories */}
        {fixedTabs.length > 0 && (
          <View style={[styles.section, subsectionsDisabled && styles.sectionDisabled]}>
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  {t('notifications.categories')}
                </ListHeader.TitleParagraph>
              }
            />
            {fixedTabs.map((tab) => {
              const topic = buildTopic('category', tab.key);
              const mandatory = MANDATORY_TOPICS.includes(topic);
              return (
                <ListRow
                  key={topic}
                  contents={
                    mandatory ? (
                      <ListRow.Texts
                        type="2RowTypeA"
                        top={tab.label}
                        bottom={t('notifications.mandatory')}
                      />
                    ) : (
                      <ListRow.Texts type="1RowTypeA" top={tab.label} />
                    )
                  }
                  right={
                    <Switch
                      checked={mandatory || isSubscribed(topic)}
                      onCheckedChange={(v) => handleToggleTopic(topic, v)}
                      disabled={mandatory || subsectionsDisabled}
                    />
                  }
                />
              );
            })}
          </View>
        )}

        {/* Departments (only user's selected depts per picker tab) */}
        {pickerTabs.length > 0 && (
          <View style={[styles.section, subsectionsDisabled && styles.sectionDisabled]}>
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  {t('notifications.departments')}
                </ListHeader.TitleParagraph>
              }
            />

            {pickerTabs.flatMap((tab) => {
              const selectedIds = pickerSelections[tab.key] ?? [];
              const picker = tab.picker;
              if (!picker || selectedIds.length === 0) return [];

              return selectedIds.map((deptId) => {
                const dept = picker.departments.find((d) => d.id === deptId);
                if (!dept) return null;
                const topic = buildTopic('dept', deptId);
                const mandatory = MANDATORY_TOPICS.includes(topic);
                return (
                  <ListRow
                    key={topic}
                    contents={
                      mandatory ? (
                        <ListRow.Texts
                          type="2RowTypeA"
                          top={dept.name}
                          bottom={t('notifications.mandatory')}
                        />
                      ) : (
                        <ListRow.Texts type="1RowTypeA" top={dept.name} />
                      )
                    }
                    right={
                      <Switch
                        checked={mandatory || isSubscribed(topic)}
                        onCheckedChange={(v) => handleToggleTopic(topic, v)}
                        disabled={mandatory || subsectionsDisabled}
                      />
                    }
                  />
                );
              });
            })}

            <View style={styles.hint}>
              <Txt typography="t7" color={SdsColors.grey500}>
                {t('notifications.departmentHint')}
              </Txt>
            </View>
          </View>
        )}

        {/* Tabs-error retry */}
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

// ── Sub-components ──

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
  sectionDisabled: {
    opacity: 0.4,
  },
  hint: {
    paddingHorizontal: 24,
    paddingVertical: 8,
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
