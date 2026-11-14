// SEE: docs/explanation/shared-map.md ("What the shared shell rebuilds"), each NativeTabs behavior this shell owes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useNavigation, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { TabSlot, useTabsWithTriggers, type TabsDescriptor, type TabsSlotRenderOptions } from 'expo-router/ui';
import { useT, type TabRoute } from '@skkuverse/shared';
import { TabBarInsetContext } from '@/components/useTabBarInset';
import { TabRetapContext, type TabRetapRegistry } from '@/components/useScrollToTopOnRetap';
import { TabBarMinimizeProvider } from '@/components/useTabBarMinimize';
import { MapHost } from '@/features/map/MapHost';
import { LOCATION_SUGGESTIONS } from './shell.constants';
import { MAP_TAB_OF_ROUTE } from '@/features/map/map-tabs.constants';
import { MapSheetViews } from '@/features/map/MapSheetViews';
import { backOnMapTab, followFocusedRoute, popMapTaskToRoot } from '@/features/map/map.service';
import type { MapTabId } from '@/features/map/map-config.types';
import type { MapSheetViewTable } from '@/features/map/sheet-views.types';
import { useNoticesAccessory } from '@/features/notices/useNoticesAccessory';
import { TransitPlaceFeed } from '@/features/transit/TransitPlaceFeed';
import { TransitSheetViews } from '@/features/transit/TransitSheetViews';
import { logTabSwitch } from '@/platform/analytics';
import { useScreenReader } from '@/platform/useScreenReader';
import { SharedMapTabBar, useGlassChrome, useKeyboardShown } from './SharedMapTabBar';
import {
  NOTICES_BADGE_VISIBLE,
  TAB_BACK_BEHAVIOR,
  TAB_ORDER,
  decideRetap,
  decideShellBack,
  noticesBadge,
  tabContentLayout,
} from './tab-bar.rules';
import { screenToTabRoute } from './tabs.rules';
import { useTabLayout } from './useTabLayout';

const SHEET_VIEWS = { ...MapSheetViews, ...TransitSheetViews } satisfies MapSheetViewTable;

// QUIRK(expo-router): `Tabs` only finds a `<TabList>` that is its direct child, and this bar sits inside the map host.
const TRIGGERS = TAB_ORDER.map((tab) => ({ type: 'internal' as const, name: tab, href: `/${tab}` as const }));

// EVIDENCE: expo-router's vendored ResourceSavingView.js:6.
const FAR_FAR_AWAY = 30000;

const styles = StyleSheet.create({
  root: { flex: 1 },
  // QUIRK(expo-router): `TabSlot` ignores a `pointerEvents` prop.
  slot: { flex: 1, pointerEvents: 'box-none' },
  tabClip: { overflow: 'hidden' },
  tabContent: { flex: 1 },
  detached: { top: FAR_FAR_AWAY },
});

export function SharedMapShell() {
  const { t } = useT();
  const navigation = useNavigation();
  const router = useRouter();
  const { setLastTab, unreadCount } = useTabLayout();
  // WHY: TAB_BACK_BEHAVIOR is 'none', or a cold start on a map tab loops back and forth with home.
  const { NavigationContent } = useTabsWithTriggers({ triggers: TRIGGERS, backBehavior: TAB_BACK_BEHAVIOR });

  // WHY: widened, since the inferred type comes from the Metro-generated router.d.ts, absent on a clean checkout.
  const segments: string[] = useSegments();
  const tabRoute: TabRoute | null =
    segments[0] === '(tabs)' ? screenToTabRoute(segments[1] ?? '') : null;

  const [mapTab, setMapTab] = useState<MapTabId>('map');
  const nextMapTab = tabRoute ? MAP_TAB_OF_ROUTE[tabRoute] : null;
  if (nextMapTab && nextMapTab !== mapTab) setMapTab(nextMapTab);

  // WHY: keyed on the focused route, not `mapTab`, which holds still while home or notices or a pushed page is in front.
  const focusedRoute = useRef(tabRoute);
  useEffect(() => {
    followFocusedRoute(focusedRoute.current, tabRoute);
    focusedRoute.current = tabRoute;
  }, [tabRoute]);

  // QUIRK(ios): the long-press back menu reads the root Stack's (tabs) entry title.
  useEffect(() => {
    if (tabRoute) navigation.setOptions({ title: t(`nav.${tabRoute}`) });
  }, [tabRoute, t, navigation]);

  useEffect(() => {
    if (!tabRoute) return;
    logTabSwitch(tabRoute);
    setLastTab(tabRoute);
  }, [tabRoute, setLastTab]);

  const glass = useGlassChrome();
  const toolbar = useMemo(() => ({ glass }), [glass]);
  const screenReaderOn = useScreenReader();
  const keyboardShown = useKeyboardShown();
  const reduceMotion = useReducedMotion();
  const [barInset, setBarInset] = useState(0);
  const [accessoryInset, setAccessoryInset] = useState(0);
  const noticesAccessoryAllowed = useNoticesAccessory();
  const showNoticesAccessory = tabRoute === 'notices' && segments.length <= 2 && noticesAccessoryAllowed;

  // QUIRK(expo-router): `renderFadingTabScreen`'s views take every touch, so a pan over the map moved nothing.
  // QUIRK(react-native): Fabric remounts `display: 'none'` natively on every switch, so a hidden tab moves off screen.
  // SEE: docs/explanation/shared-map.md ("What the shared shell rebuilds")
  const renderTab = useCallback(
    (descriptor: TabsDescriptor, { isFocused, loaded }: TabsSlotRenderOptions) => {
      if (!loaded && !isFocused) return null;
      const route = screenToTabRoute(descriptor.route.name);
      const layout = route
        ? tabContentLayout(route, { bar: barInset, accessory: route === 'notices' ? accessoryInset : 0 })
        : { inset: 0 };
      const touch = isFocused ? 'box-none' : 'none';
      // WHY: off screen is still in the accessibility tree, so a hidden tab hides itself or a swipe reaches all four tabs.
      return (
        <View
          key={descriptor.route.key}
          pointerEvents={touch}
          accessibilityElementsHidden={!isFocused}
          importantForAccessibility={isFocused ? 'auto' : 'no-hide-descendants'}
          style={[StyleSheet.absoluteFill, styles.tabClip]}
        >
          <View
            collapsable={false}
            removeClippedSubviews={Platform.OS === 'ios' ? !isFocused : true}
            pointerEvents={touch}
            style={[styles.tabContent, isFocused ? null : styles.detached]}
          >
            <TabBarInsetContext.Provider value={layout.inset}>{descriptor.render()}</TabBarInsetContext.Provider>
          </View>
        </View>
      );
    },
    [barInset, accessoryInset],
  );

  const retap = useMemo(() => {
    const scrollers = new Map<TabRoute, Set<() => void>>();
    const registry: TabRetapRegistry = {
      register: (tab, scrollToTop) => {
        const set = scrollers.get(tab) ?? new Set();
        set.add(scrollToTop);
        scrollers.set(tab, set);
        return () => set.delete(scrollToTop);
      },
    };
    const scrollToTop = (tab: TabRoute) => scrollers.get(tab)?.forEach((scroll) => scroll());
    return { registry, scrollToTop };
  }, []);

  const handleTabPress = useCallback(
    (tab: TabRoute) => {
      if (tab !== tabRoute) return;
      const decision = decideRetap(tab);
      if (decision.kind === 'mapTask' && popMapTaskToRoot(decision.tab)) return;
      retap.scrollToTop(tab);
    },
    [tabRoute, retap],
  );

  // WHY: a focus effect, so a page pushed over the tabs takes the back key.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        const decision = decideShellBack(tabRoute);
        switch (decision.kind) {
          case 'system':
            return false;
          case 'mapTab':
            if (backOnMapTab(decision.tab, SHEET_VIEWS, screenReaderOn) === 'home') router.navigate('/home');
            return true;
          case 'home':
            router.navigate('/home');
            return true;
        }
      });
      return () => sub.remove();
    }, [tabRoute, router, screenReaderOn]),
  );

  const content = (
    <NavigationContent>
      <TabRetapContext.Provider value={retap.registry}>
        <TabBarInsetContext.Provider value={barInset}>
          <MapHost
            sheetViews={SHEET_VIEWS}
            tabScope="byTab"
            tab={mapTab}
            hiddenFromScreenReader={screenReaderOn}
            visibleMapCamera
            launchAtUser={LOCATION_SUGGESTIONS}
            campusSuggestions={LOCATION_SUGGESTIONS}
            toolbar={toolbar}
          >
            <TransitPlaceFeed />
            <TabSlot detachInactiveScreens={false} style={styles.slot} renderFn={renderTab} />
            <SharedMapTabBar
              glass={glass}
              hidden={keyboardShown}
              focusedTab={tabRoute}
              onTabPress={handleTabPress}
              noticesBadge={noticesBadge(unreadCount, NOTICES_BADGE_VISIBLE)}
              showNoticesAccessory={showNoticesAccessory}
              onInsetChange={setBarInset}
              onAccessoryChange={setAccessoryInset}
            />
          </MapHost>
        </TabBarInsetContext.Provider>
      </TabRetapContext.Provider>
    </NavigationContent>
  );

  return (
    <View style={styles.root}>
      {reduceMotion ? content : <TabBarMinimizeProvider>{content}</TabBarMinimizeProvider>}
    </View>
  );
}
