/**
 * Notification settings — view-only layout (v3).
 *
 * Renders all 9 server tabs (fixed + picker) in the order returned by
 * GET /notices/tabs. The screen is view-only: picker edits happen
 * exclusively in the notices tab's picker sheet flow (single edit channel).
 *
 *  - Master toggle: preferences.enabled + OS permission request on ON.
 *  - Fixed tab row: single toggle on topic `category:{tabKey}`.
 *  - Picker tab section: header + indented toggles for each selected deptId
 *    (topic = `{pickerPrefixForTabKey(tab.key)}:{deptId}`). Empty state
 *    links to the notices tab root (deep-linking with auto-open picker is
 *    out of scope this PR).
 *  - Unknown tabMode / unknown picker tabKey → rendered as null with a
 *    `__DEV__` warning, never an empty shell.
 *
 * Writes use `updateSubscribedTopics` delta API (arrayUnion / arrayRemove)
 * for per-call atomicity. The master toggle still uses `updatePreferences`
 * since it writes the `enabled` field, which is orthogonal to the array.
 */

import { useCallback, useEffect, useState } from 'react';
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
    subscribedTopics: [...MANDATORY_TOPICS],
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

  const handleToggleTopic = useCallback(
    async (topic: string, nextValue: boolean) => {
      if (MANDATORY_TOPICS.includes(topic)) return;
      if (!uid) return;

      // Optimistic local update for instant UI.
      const currentSet = new Set(localPrefs.subscribedTopics);
      if (nextValue) currentSet.add(topic);
      else currentSet.delete(topic);
      setLocalPrefs({
        enabled: localPrefs.enabled,
        subscribedTopics: [...currentSet],
      });

      // Delta write — per-call atomic, no multi-device lost update race.
      try {
        if (nextValue) {
          await updateSubscribedTopics(uid, { add: [topic] });
        } else {
          await updateSubscribedTopics(uid, { remove: [topic] });
        }
      } catch (err) {
        logHandledError('notifications/toggle-topic', err);
      }
    },
    [uid, localPrefs],
  );

  const isSubscribed = useCallback(
    (topic: string) => localPrefs.subscribedTopics.includes(topic),
    [localPrefs.subscribedTopics],
  );

  const tabs: NoticeTab[] = tabsConfig?.tabs ?? [];
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

        {/* Server-ordered single iteration over every tab */}
        {tabs.map((tab) => {
          if (tab.tabMode === 'fixed') {
            return (
              <FixedTabRow
                key={tab.key}
                tab={tab}
                isSubscribed={isSubscribed}
                onToggleTopic={handleToggleTopic}
                disabled={subsectionsDisabled}
                sectionStyle={subsectionsDisabled ? styles.sectionDisabled : undefined}
                mandatoryLabel={t('notifications.mandatory')}
              />
            );
          }
          if (tab.tabMode === 'picker') {
            // Share the same (stored → server defaults → first dept) fallback
            // as NoticesTabScreen so picker defaults appear here without a
            // prior picker confirm. Empty state only surfaces in the degenerate
            // case where the server returns neither defaults nor departments.
            const resolvedIds = resolvePickerSelection(
              tab,
              pickerSelections[tab.key],
            );
            return (
              <PickerTabSection
                key={tab.key}
                tab={tab}
                selectedIds={resolvedIds}
                isSubscribed={isSubscribed}
                onToggleTopic={handleToggleTopic}
                onGoToNotices={() => router.push('/(tabs)/notices' as never)}
                disabled={subsectionsDisabled}
                sectionStyle={subsectionsDisabled ? styles.sectionDisabled : undefined}
                emptyLabel={t('notifications.pickerEmpty')}
                goToNoticesLabel={t('notifications.goToNotices')}
                mandatoryLabel={t('notifications.mandatory')}
              />
            );
          }
          if (__DEV__) {
            console.warn(
              '[notifications] unsupported tabMode:',
              (tab as { tabMode?: string }).tabMode,
              tab.key,
            );
          }
          return null;
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

function FixedTabRow({
  tab,
  isSubscribed,
  onToggleTopic,
  disabled,
  sectionStyle,
  mandatoryLabel,
}: {
  tab: NoticeTab;
  isSubscribed: (topic: string) => boolean;
  onToggleTopic: (topic: string, next: boolean) => void;
  disabled: boolean;
  sectionStyle: object | undefined;
  mandatoryLabel: string;
}) {
  const topic = buildTopic('category', tab.key);
  const mandatory = MANDATORY_TOPICS.includes(topic);
  return (
    <View style={[styles.section, sectionStyle]}>
      <ListRow
        contents={
          mandatory ? (
            <ListRow.Texts
              type="2RowTypeA"
              top={tab.label}
              bottom={mandatoryLabel}
            />
          ) : (
            <ListRow.Texts type="1RowTypeA" top={tab.label} />
          )
        }
        right={
          <Switch
            checked={mandatory || isSubscribed(topic)}
            onCheckedChange={(v) => onToggleTopic(topic, v)}
            disabled={mandatory || disabled}
          />
        }
      />
    </View>
  );
}

function PickerTabSection({
  tab,
  selectedIds,
  isSubscribed,
  onToggleTopic,
  onGoToNotices,
  disabled,
  sectionStyle,
  emptyLabel,
  goToNoticesLabel,
  mandatoryLabel,
}: {
  tab: NoticeTab;
  selectedIds: string[];
  isSubscribed: (topic: string) => boolean;
  onToggleTopic: (topic: string, next: boolean) => void;
  onGoToNotices: () => void;
  disabled: boolean;
  sectionStyle: object | undefined;
  emptyLabel: string;
  goToNoticesLabel: string;
  mandatoryLabel: string;
}) {
  const prefix = pickerPrefixForTabKey(tab.key);
  if (!prefix) {
    if (__DEV__) {
      console.warn('[notifications] no topic prefix for picker tab', tab.key);
    }
    return null;
  }

  const picker = tab.picker;
  if (!picker) return null;

  const hasSelection = selectedIds.length > 0;

  return (
    <View style={[styles.section, sectionStyle]}>
      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
            {tab.label}
          </ListHeader.TitleParagraph>
        }
      />

      {hasSelection ? (
        selectedIds.map((deptId) => {
          const dept = picker.departments.find((d) => d.id === deptId);
          if (!dept) return null;
          const topic = buildTopic(prefix, deptId);
          const mandatory = MANDATORY_TOPICS.includes(topic);
          return (
            <View key={topic} style={styles.indentedRow}>
              <ListRow
                contents={
                  mandatory ? (
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={dept.name}
                      bottom={mandatoryLabel}
                    />
                  ) : (
                    <ListRow.Texts type="1RowTypeA" top={dept.name} />
                  )
                }
                right={
                  <Switch
                    checked={mandatory || isSubscribed(topic)}
                    onCheckedChange={(v) => onToggleTopic(topic, v)}
                    disabled={mandatory || disabled}
                  />
                }
              />
            </View>
          );
        })
      ) : (
        <View style={styles.emptyBlock}>
          <Txt typography="t6" color={SdsColors.grey500}>
            {emptyLabel}
          </Txt>
          <Button
            type="dark"
            style="weak"
            size="tiny"
            onPress={onGoToNotices}
            disabled={disabled}
          >
            {goToNoticesLabel}
          </Button>
        </View>
      )}
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
  indentedRow: {
    paddingLeft: SdsSpacing.lg,
  },
  emptyBlock: {
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    gap: SdsSpacing.sm,
    alignItems: 'flex-start',
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
