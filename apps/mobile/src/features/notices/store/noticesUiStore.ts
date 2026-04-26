/**
 * Notices UI store — bridges the custom Stack header (NoticesHeader) and the
 * screen body (NoticesTabScreen) which are siblings rendered by expo-router
 * Stack and cannot share state via Context (the header is mounted by the
 * navigator outside the screen's React subtree).
 *
 * Why this exists: the notices tab moved its 9-tab fluid Tab control from the
 * screen body to the Stack custom header so that iOS 26 NativeTabs
 * `tabBarMinimizeBehavior` finds only the SectionList in the body view tree.
 * The Tab needs to drive which panel renders in the body — hence this store.
 */

import { create } from 'zustand';

interface NoticesUiState {
  activeTabKey: string;
  setActiveTabKey: (key: string) => void;
}

export const useNoticesUiStore = create<NoticesUiState>((set) => ({
  activeTabKey: '',
  setActiveTabKey: (key) => set({ activeTabKey: key }),
}));
