/**
 * Notification settings — tab-level on/off (v4).
 *
 * Renders all server tabs (fixed + picker) in the order returned by
 * GET /notices/tabs as a single unified row per tab. Per-sub-item picking
 * (e.g. selecting individual departments/libraries) has been removed from
 * this screen — picker tabs now toggle the union of (user selection ∪ server
 * defaults) as a single subscription set. The picker sheet in the notices tab
 * still exists, but is a view-only filter for the notice list.
 *
 *  - Master toggle: preferences.enabled + OS permission request on ON.
 *  - Per-tab toggle:
 *     - fixed  → topic = [`category:${tab.key}`]
 *     - picker → topics = resolvePickerSelection(tab, stored).map(buildTopic)
 *  - isTabEnabled: intersection of target topics with subscribedTopics is
 *    non-empty. This is intentionally lenient — stale partial subscriptions
 *    (e.g. left over from the v3 per-item UX) read as "on" and get fully
 *    re-synchronised on the next toggle flip or notices-tab picker confirm.
 *
 * Writes use `updateSubscribedTopics` delta API (arrayUnion / arrayRemove)
 * for per-call atomicity — the master toggle still uses `updatePreferences`
 * since it writes the `enabled` field, which is orthogonal to the array.
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
  ListRow,
  Switch,
  Txt,
} from '@skkuverse/sds';
import {
  MANDATORY_TOPICS,
  SdsColors,
  SdsSpacing,
  buildTopic,
  pickerPrefixForTabKey,
  resolvePickerSelection,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useSettingsStore,
  useT,
  type NoticeTab,
  type PreferencesDocument,
  type TranslationKey,
} from '@skkuverse/shared';
import {
  updatePreferences,
  updateSubscribedTopics,
} from '@/services/firestore-notifications';
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

  const [localPrefs, setLocalPrefs] = useState<PreferencesDocument>({
    enabled: false,
    categoryEnabled: { essential: false, services: false, notices: false },
    pickerSelections: {},
    subscribedTopics: [...MANDATORY_TOPICS],
    derivedAt: null,
  });

  useEffect(() => {
    if (prefs) setLocalPrefs(prefs);
  }, [prefs]);

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
    async (nextValue: boolean) => {
      if (!uid) return;

      if (nextValue) {
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
        try {
          await updatePreferences(uid, next);
        } catch (err) {
          logHandledError('notifications/update-preferences', err);
        }
      } else {
        const next: PreferencesDocument = {
          ...localPrefs,
          enabled: false,
        };
        setLocalPrefs(next);
        try {
          await updatePreferences(uid, next);
        } catch (err) {
          logHandledError('notifications/update-preferences', err);
        }
      }
    },
    [uid, localPrefs, setPermissionStatus],
  );

  // Compute the topic set backing a single tab row.
  // Picker tabs fan out to the resolved selection (user picks ∪ server
  // defaults ∪ first-dept fallback) — the same set NoticesTabScreen renders,
  // so the tab toggle is a promise about every item the user can see.
  const topicsForTab = useCallback(
    (tab: NoticeTab): string[] => {
      if (tab.tabMode === 'fixed') {
        return [buildTopic('category', tab.key)];
      }
      if (tab.tabMode === 'picker') {
        const prefix = pickerPrefixForTabKey(tab.key);
        if (!prefix) {
          if (__DEV__) {
            console.warn(
              '[notifications] no topic prefix for picker tab',
              tab.key,
            );
          }
          return [];
        }
        return resolvePickerSelection(tab, pickerSelections[tab.key]).map(
          (id) => buildTopic(prefix, id),
        );
      }
      return [];
    },
    [pickerSelections],
  );

  const isTabEnabled = useCallback(
    (tab: NoticeTab): boolean => {
      const targets = topicsForTab(tab);
      if (targets.length === 0) return false;
      const subs = new Set(localPrefs.subscribedTopics);
      return targets.some((topic) => subs.has(topic));
    },
    [topicsForTab, localPrefs.subscribedTopics],
  );

  const handleToggleTab = useCallback(
    async (tab: NoticeTab, nextValue: boolean) => {
      if (!uid) return;
      const targets = topicsForTab(tab);
      if (targets.length === 0) return;

      // Optimistic local update so the switch settles without awaiting the
      // round-trip. onSnapshot reconciliation will overwrite on error.
      const nextSet = new Set(localPrefs.subscribedTopics);
      if (nextValue) {
        targets.forEach((topic) => nextSet.add(topic));
      } else {
        targets.forEach((topic) => nextSet.delete(topic));
      }
      setLocalPrefs({
        ...localPrefs,
        subscribedTopics: [...nextSet],
      });

      try {
        if (nextValue) {
          await updateSubscribedTopics(uid, { add: targets });
        } else {
          await updateSubscribedTopics(uid, { remove: targets });
        }
      } catch (err) {
        logHandledError('notifications/tab-toggle', err);
      }
    },
    [uid, localPrefs, topicsForTab],
  );

  const tabs: NoticeTab[] = useMemo(() => tabsConfig?.tabs ?? [], [tabsConfig]);
  const masterOff = !localPrefs.enabled;
  const subsectionsDisabled = masterOff || prefsLoading;

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

        {/* One unified row per server tab — picker vs fixed distinction is
            absorbed by topicsForTab(). */}
        {tabs.map((tab) => {
          if (tab.tabMode !== 'fixed' && tab.tabMode !== 'picker') {
            if (__DEV__) {
              console.warn(
                '[notifications] unsupported tabMode:',
                (tab as { tabMode?: string }).tabMode,
                tab.key,
              );
            }
            return null;
          }
          const targets = topicsForTab(tab);
          const mandatoryForTab = targets.some((topic) =>
            MANDATORY_TOPICS.includes(topic),
          );
          return (
            <TabRow
              key={tab.key}
              tab={tab}
              checked={mandatoryForTab || isTabEnabled(tab)}
              onToggle={(v) => handleToggleTab(tab, v)}
              disabled={mandatoryForTab || subsectionsDisabled}
              sectionStyle={subsectionsDisabled ? styles.sectionDisabled : undefined}
              bottomLabel={mandatoryForTab ? t('notifications.mandatory') : undefined}
            />
          );
        })}

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

// ── Row / section components ──

function TabRow({
  tab,
  checked,
  onToggle,
  disabled,
  sectionStyle,
  bottomLabel,
}: {
  tab: NoticeTab;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled: boolean;
  sectionStyle: object | undefined;
  bottomLabel: string | undefined;
}) {
  return (
    <View style={[styles.section, sectionStyle]}>
      <ListRow
        contents={
          bottomLabel ? (
            <ListRow.Texts
              type="2RowTypeA"
              top={tab.label}
              bottom={bottomLabel}
            />
          ) : (
            <ListRow.Texts type="1RowTypeA" top={tab.label} />
          )
        }
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
  sectionDisabled: {
    opacity: 0.4,
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
