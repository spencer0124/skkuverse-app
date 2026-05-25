import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  SdsSpacing,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { setNoticeTabEnabled } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';
import { TabToggleRow } from '@/features/notifications/components/TabToggleRow';

/**
 * Step 6 — 카테고리 토글 페이지.
 *
 * - 진입 전 prepareCategoryStep에서 `seedOnboardingPreferences(..., {finalize:false})`로
 *   doc seed 완료. useAppInit의 prefs listener가 즉시 mirror.
 * - 각 토글은 setNoticeTabEnabled (dot-path update) — settings 화면과 100% 동일.
 * - preferences가 아직 mirror 안 됐을 때(1~2 frame race) 모든 탭 default-on으로
 *   표시 — seed 도착 시 그대로 일치 (CF derive contract: undefined → ON).
 * - OnboardingLayout의 horizontal padding(SdsSpacing.xl)을 negative margin으로
 *   cancel해서 카테고리 리스트는 화면 끝까지 풀-width (TabToggleRow가 자체
 *   paddingHorizontal:24를 가짐 — settings 화면과 동일한 시각).
 */
export function NoticeCategoriesStep() {
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const preferences = useNotificationStore((s) => s.preferences);

  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();

  const handleToggle = useCallback(
    async (tabKey: string, next: boolean) => {
      if (!uid) return;
      try {
        await setNoticeTabEnabled(uid, tabKey, next);
      } catch (err) {
        logHandledError('onboarding/set-notice-tab', err);
      }
    },
    [uid],
  );

  const isOn = useCallback(
    (key: string) => preferences.noticeTabEnabled?.[key] !== false,
    [preferences.noticeTabEnabled],
  );

  return (
    <View style={styles.container}>
      <Txt
        typography="t1"
        fontWeight="bold"
        color={SdsColors.grey900}
        style={styles.title}
      >
        {t('onboarding.categoriesTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {t('onboarding.categoriesSubtitle')}
      </Txt>

      <ScrollView
        style={styles.listFlex}
        contentContainerStyle={styles.listInner}
        showsVerticalScrollIndicator={false}
      >
        {tabsConfig?.tabs.map((tab) => (
          <TabToggleRow
            key={tab.key}
            tab={tab}
            checked={isOn(tab.key)}
            onChange={(v) => handleToggle(tab.key, v)}
            disabled={false}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
  },
  listFlex: {
    flex: 1,
    // OnboardingLayout의 paddingHorizontal:SdsSpacing.xl을 무효화하여
    // TabToggleRow의 자체 padding(24)이 settings 화면과 동일한 시각 제공.
    marginHorizontal: -SdsSpacing.xl,
  },
  listInner: {
    paddingBottom: 24,
  },
  retryBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
});
