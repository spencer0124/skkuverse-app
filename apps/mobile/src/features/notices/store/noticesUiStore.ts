/**
 * Notices UI store — bridges the custom Stack header (NoticesHeader), the
 * screen body (NoticesTabScreen), and the iOS 26 NativeTabs bottom accessory
 * (NoticesAccessoryBar). All three are siblings rendered by different parent
 * trees (Stack header, RNSScreen body, RNSBottomTabsAccessory) and cannot
 * share state via Context.
 *
 * Why this exists:
 *   1. notices tab moved its 9-tab fluid Tab control from the screen body to
 *      the Stack custom header so iOS 26 `tabBarMinimizeBehavior` finds only
 *      the SectionList in the body view tree.
 *   2. The bottom accessory (search/filter) lives outside the screen tree,
 *      and on RN >= 0.82 (Expo SDK 55+) rn-screens mounts BOTH 'regular' and
 *      'inline' instances simultaneously — local state would desync.
 *   External store solves both.
 */

import { create } from 'zustand';

interface NoticesUiState {
  activeTabKey: string;
  setActiveTabKey: (key: string) => void;
  // accessory state — hoisted for SDK 55 readiness (rn-screens 2-instance mount)
  accessorySearchQuery: string;
  setAccessorySearchQuery: (q: string) => void;
}

export const useNoticesUiStore = create<NoticesUiState>((set) => ({
  activeTabKey: '',
  setActiveTabKey: (key) => set({ activeTabKey: key }),
  accessorySearchQuery: '',
  setAccessorySearchQuery: (q) => set({ accessorySearchQuery: q }),
}));
