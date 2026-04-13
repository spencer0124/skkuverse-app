import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';
import { CRAWLER_ENABLED_DEPT_IDS } from '../notices/constants';

/** HSSC = 인문사회과학캠퍼스, NSC = 자연과학캠퍼스 */
export type Campus = 'hssc' | 'nsc';

export type AppLanguage = 'ko' | 'en' | 'zh';

export type TabRoute = 'campus' | 'transit' | 'notices';

/** First non-main department as default selection */
const DEFAULT_DEPT_IDS = [
  CRAWLER_ENABLED_DEPT_IDS.find((id) => id !== 'skku-main') ?? 'cal-undergrad',
];

export interface SettingsState {
  preferredCampus: Campus;
  appLanguage: AppLanguage;
  lastTab: TabRoute;
  selectedDeptIds: string[];
}

interface SettingsActions {
  setPreferredCampus: (campus: Campus) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setLastTab: (tab: TabRoute) => void;
  setSelectedDeptIds: (ids: string[]) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * Persisted settings store — backed by MMKV via Zustand persist middleware.
 *
 * Replaces Flutter's SharedPreferences for:
 * - Last selected tab (app_shell_controller.dart → _tabKey)
 * - Preferred campus (defaulting to HSSC)
 * - App language preference
 *
 * MMKV hydration is synchronous, so the store is ready instantly on app start.
 * No loading state or hydration gate needed.
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      preferredCampus: 'hssc',
      appLanguage: 'ko',
      lastTab: 'notices',
      selectedDeptIds: DEFAULT_DEPT_IDS,

      setPreferredCampus: (campus) => set({ preferredCampus: campus }),
      setAppLanguage: (language) => set({ appLanguage: language }),
      setLastTab: (tab) => set({ lastTab: tab }),
      setSelectedDeptIds: (ids) => set({ selectedDeptIds: ids }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);
