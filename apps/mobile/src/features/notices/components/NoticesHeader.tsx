/**
 * 2-row custom header for the notices tab.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  (safe area top inset)                           │
 *   │  공지사항            🔍 🔖 🔔                  │  ← Row 1: 44pt
 *   ├──────────────────────────────────────────────────┤
 *   │  [학과] [학사] [장학] [취업] ...      ⇄         │  ← Row 2: Tab fluid
 *   └──────────────────────────────────────────────────┘
 *
 * Why custom header (and trade-offs): the previous in-body Tab control was
 * a horizontal ScrollView (Tab fluid), which iOS 26 `tabBarMinimizeBehavior`
 * picks up via first-descendant chain instead of the SectionList. Moving Tab
 * to the Stack header removes it from the screen body view tree → UIKit
 * finds only the SectionList → minimize triggers correctly.
 *
 * Trade-off: the previous index.tsx used `unstable_headerLeftItems` /
 * `unstable_headerRightItems` to get iOS 26 Liquid Glass per-button capsules
 * (RNSBarButtonItem.mm `sharesBackground: false`). A React-rendered header
 * cannot reproduce that native capsule — we get plain Pressable touch areas
 * instead. Acceptable trade-off for unblocking minimize-on-scroll.
 *
 * State sharing: see `noticesUiStore` for why the Tab reads/writes
 * `activeTabKey` through Zustand instead of props/context.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellIcon,
  BellSlashIcon,
  BookmarkSimpleIcon,
  CaretLeftIcon,
  MagnifyingGlassIcon,
} from 'phosphor-react-native';
import {
  SdsColors,
  SdsTypo,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { Tab } from '@skkuverse/sds';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { useNoticesUiStore } from '../store/noticesUiStore';

interface Props {
  /** True when this header sits above a pushed (non-root) screen. Shows back. */
  showBack?: boolean;
}

export function NoticesHeader({ showBack = false }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const router = useRouter();
  const { data: tabsConfig } = useNoticeTabs();
  const tabs = tabsConfig?.tabs ?? [];
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const setActiveTabKey = useNoticesUiStore((s) => s.setActiveTabKey);
  const noticesEnabled = useNotificationStore(
    (s) => s.preferences.categoryEnabled?.notices ?? false,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Row 1: Toss-style left title + 3 right action icons */}
      <View style={styles.titleRow}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
              <CaretLeftIcon size={24} color={SdsColors.grey700} weight="bold" />
            </Pressable>
          ) : null}
          <Text style={styles.title}>{t('nav.notices')}</Text>
        </View>
        <View style={styles.right}>
          <HeaderIconButton
            onPress={() => {
              // TODO: 검색 화면 라우트 연결
            }}
            accessibilityRole="button"
            accessibilityLabel="검색"
          >
            <MagnifyingGlassIcon size={22} color={SdsColors.grey700} />
          </HeaderIconButton>
          <HeaderIconButton
            onPress={() => {
              // TODO: 보관함 화면 라우트 연결
            }}
            accessibilityRole="button"
            accessibilityLabel="보관함"
          >
            <BookmarkSimpleIcon size={22} color={SdsColors.grey700} />
          </HeaderIconButton>
          <HeaderIconButton
            onPress={() => router.push('/notifications/settings' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.settings')}
          >
            {noticesEnabled ? (
              <BellIcon size={22} color={SdsColors.grey700} />
            ) : (
              <BellSlashIcon size={22} color={SdsColors.grey500} />
            )}
          </HeaderIconButton>
        </View>
      </View>

      {/* Row 2: Tab fluid — only render once tabs loaded to avoid flash */}
      {tabs.length > 0 ? (
        <Tab value={activeTabKey} onChange={setActiveTabKey} size="small" fluid>
          {tabs.map((tab) => (
            <Tab.Item key={tab.key} value={tab.key}>
              {tab.label}
            </Tab.Item>
          ))}
        </Tab>
      ) : (
        <View style={styles.tabPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SdsColors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey200,
  },
  titleRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  title: {
    ...SdsTypo.t3,
    color: SdsColors.grey900,
  },
  tabPlaceholder: {
    height: 44,
  },
});
