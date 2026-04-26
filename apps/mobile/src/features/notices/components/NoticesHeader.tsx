/**
 * 2-row custom header for the notices tab.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  (safe area top inset)                           │
 *   │                              🔖  🔔             │  ← Row 1: 44pt (no title, mirrors home)
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
 * Per-button Liquid Glass: the right-side action icons each get an iOS 26
 * Liquid Glass capsule via `expo-glass-effect`'s `GlassView` (UIVisualEffectView
 * + UIGlassEffect — the same native material as `unstable_headerRightItems`
 * with `sharesBackground: false`). Activated through the `glass` prop on
 * `HeaderIconButton`. iOS<26 / Android: plain Pressable, no glass.
 *
 * State sharing: see `noticesUiStore` for why the Tab reads/writes
 * `activeTabKey` through Zustand instead of props/context.
 */

import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeftIcon } from 'phosphor-react-native';
import { SdsColors, useNoticeTabs, useT } from '@skkuverse/shared';
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Row 1: empty title (mirrors home tab) + right action icons */}
      <View style={styles.titleRow}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
              <CaretLeftIcon size={24} color={SdsColors.grey700} weight="bold" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.right}>
          <HeaderIconButton
            glass
            onPress={() => {
              // TODO: 보관함 화면 라우트 연결
            }}
            accessibilityRole="button"
            accessibilityLabel="보관함"
          >
            <Image
              source={require('../../../../assets/header-icons/bookmark-simple.png')}
              style={styles.icon}
            />
          </HeaderIconButton>
          <HeaderIconButton
            glass
            onPress={() => router.push('/notifications/settings' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.settings')}
          >
            <Image
              source={require('../../../../assets/header-icons/bell.png')}
              style={styles.icon}
            />
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
    gap: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  tabPlaceholder: {
    height: 44,
  },
  // PNG icons exported at 22pt baked color (see scripts/export-header-icons.mjs).
  // Displayed at 18pt to give the 36×36 capsule ~9pt of visible padding around
  // the glyph, matching home tab's perceived icon-to-capsule ratio.
  icon: {
    width: 18,
    height: 18,
  },
});
