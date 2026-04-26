/**
 * Custom header for the notices tab — Tab fluid only.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  (safe area top inset)                           │
 *   │  [학과] [학사] [장학] [취업] ...      ⇄         │  ← Tab fluid
 *   └──────────────────────────────────────────────────┘
 *
 * Why custom header (and trade-offs): the previous in-body Tab control was
 * a horizontal ScrollView (Tab fluid), which iOS 26 `tabBarMinimizeBehavior`
 * picks up via first-descendant chain instead of the SectionList. Moving Tab
 * to the Stack header removes it from the screen body view tree → UIKit
 * finds only the SectionList → minimize triggers correctly.
 *
 * State sharing: see `noticesUiStore` for why the Tab reads/writes
 * `activeTabKey` through Zustand instead of props/context.
 */

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsColors, useNoticeTabs } from '@skkuverse/shared';
import { Tab } from '@skkuverse/sds';
import { useNoticesUiStore } from '../store/noticesUiStore';

export function NoticesHeader() {
  const insets = useSafeAreaInsets();
  const { data: tabsConfig } = useNoticeTabs();
  const tabs = tabsConfig?.tabs ?? [];
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const setActiveTabKey = useNoticesUiStore((s) => s.setActiveTabKey);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
  tabPlaceholder: {
    height: 44,
  },
});
