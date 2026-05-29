/**
 * 9-tab horizontal strip rendered inside the notices SectionList's
 * ListHeaderComponent (via NoticeListPanel `listHeader` prop).
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  [학과] [학사] [장학] [취업] ...      ⇄         │
 *   └──────────────────────────────────────────────────┘
 *
 * Why this lives in the screen body (not a custom Stack header):
 *   The notices tab uses the native iOS bar (UINavigationBar) for the top
 *   chrome — same `unstable_headerRightItems` API as the home tab — so the
 *   profile + kebab icons get the system Liquid Glass capsule treatment.
 *   That precludes a `header: () => Component` callback (which replaces
 *   the entire bar). The 9-tab strip therefore lives in the SectionList
 *   ListHeaderComponent. Per docs/ios-26-native-tabs-minimize.md (chain
 *   root rule), this preserves minimize-on-scroll because RNSScreen
 *   subviews[0] is still the SectionList — the strip is rendered INSIDE
 *   the list, not as a sibling.
 *
 *   Trade-off: the strip scrolls away with content (not sticky). Future
 *   sticky variant would use SectionList stickyHeaderIndices.
 *
 * State sharing: see `noticesUiStore` for why the Tab reads/writes
 * `activeTabKey` through Zustand instead of props/context.
 */

import { StyleSheet, View } from 'react-native';
import { SdsColors, useNoticeTabs } from '@skkuverse/shared';
import { Tab } from '@skkuverse/sds';
import { useNoticesUiStore } from '../store/noticesUiStore';
import { logNoticesContentSelect } from '@/services/analytics';

export function NoticesTabStrip() {
  const { data: tabsConfig } = useNoticeTabs();
  const tabs = tabsConfig?.tabs ?? [];
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const setActiveTabKey = useNoticesUiStore((s) => s.setActiveTabKey);

  const handleTabChange = (key: string) => {
    if (key !== activeTabKey) {
      logNoticesContentSelect({ content_type: 'tab_strip', item_id: key });
    }
    setActiveTabKey(key);
  };

  return (
    <View style={styles.container}>
      {tabs.length > 0 ? (
        <Tab value={activeTabKey} onChange={handleTabChange} size="small" fluid>
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
