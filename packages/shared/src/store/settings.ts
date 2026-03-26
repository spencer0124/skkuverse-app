import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';

/** HSSC = 인문사회과학캠퍼스, NSC = 자연과학캠퍼스 */
export type Campus = 'hssc' | 'nsc';

export type AppLanguage = 'ko' | 'en' | 'zh';

export interface SettingsState {
  preferredCampus: Campus;
  appLanguage: AppLanguage;
  lastTabIndex: number;
}

interface SettingsActions {
  setPreferredCampus: (campus: Campus) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setLastTabIndex: (index: number) => void;
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
      lastTabIndex: 0,

      setPreferredCampus: (campus) => set({ preferredCampus: campus }),
      setAppLanguage: (language) => set({ appLanguage: language }),
      setLastTabIndex: (index) => set({ lastTabIndex: index }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);
