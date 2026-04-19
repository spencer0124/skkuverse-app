import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';

/** HSSC = 인문사회과학캠퍼스, NSC = 자연과학캠퍼스 */
export type Campus = 'hssc' | 'nsc';

export type AppLanguage = 'ko' | 'en' | 'zh';

export type TabRoute = 'home' | 'campus' | 'transit' | 'notices';

export interface SettingsState {
  preferredCampus: Campus;
  appLanguage: AppLanguage;
  lastTab: TabRoute;
  /** Picker tab selections keyed by server tab key (e.g. 'dept', 'library'). */
  pickerSelections: Record<string, string[]>;
  /** Whether the user has completed the onboarding flow. */
  onboardingCompleted: boolean;
  /** Primary department chosen during onboarding (temporary — will move to profileStore on server sync). */
  primaryDeptId: string | null;
  /** Interest departments chosen during onboarding, max 3 (temporary — will move to profileStore on server sync). */
  interestDeptIds: string[];
}

interface SettingsActions {
  setPreferredCampus: (campus: Campus) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setLastTab: (tab: TabRoute) => void;
  setPickerSelection: (tabKey: string, ids: string[]) => void;
  completeOnboarding: (data: {
    campus: Campus;
    primaryDeptId: string;
    interestDeptIds: string[];
  }) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * Persisted settings store — backed by MMKV via Zustand persist middleware.
 *
 * MMKV hydration is synchronous, so the store is ready instantly on app start.
 * No loading state or hydration gate needed.
 *
 * v0 → v1 migration: `selectedDeptIds` / `selectedLibIds` (separate arrays)
 * → `pickerSelections` (Record keyed by server tab key).
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      preferredCampus: 'hssc',
      appLanguage: 'ko',
      lastTab: 'notices',
      pickerSelections: {},
      onboardingCompleted: false,
      primaryDeptId: null,
      interestDeptIds: [],

      setPreferredCampus: (campus) => set({ preferredCampus: campus }),
      setAppLanguage: (language) => set({ appLanguage: language }),
      setLastTab: (tab) => set({ lastTab: tab }),
      setPickerSelection: (tabKey, ids) =>
        set((s) => ({
          pickerSelections: { ...s.pickerSelections, [tabKey]: ids },
        })),
      completeOnboarding: (data) =>
        set({
          preferredCampus: data.campus,
          primaryDeptId: data.primaryDeptId,
          interestDeptIds: data.interestDeptIds,
          onboardingCompleted: true,
        }),
    }),
    {
      name: 'settings',
      version: 3,
      storage: createJSONStorage(() => mmkvStateStorage),
      migrate: (persisted, version) => {
        const state = { ...(persisted as Record<string, unknown>) };
        if (version === 0) {
          const pickerSelections: Record<string, string[]> = {};
          if (Array.isArray(state.selectedDeptIds)) {
            pickerSelections['dept'] = state.selectedDeptIds as string[];
          }
          if (Array.isArray(state.selectedLibIds)) {
            pickerSelections['library'] = state.selectedLibIds as string[];
          }
          delete state.selectedDeptIds;
          delete state.selectedLibIds;
          delete state.setSelectedDeptIds;
          delete state.setSelectedLibIds;
          state.pickerSelections = pickerSelections;
        }
        if ((version ?? 0) < 2) {
          // Existing users skip onboarding; new installs get default false.
          state.onboardingCompleted = true;
          state.primaryDeptId = state.primaryDeptId ?? null;
          state.interestDeptIds = state.interestDeptIds ?? [];
        }
        if ((version ?? 0) < 3) {
          // 'more' tab removed; its content merged into 'home'.
          if (state.lastTab === 'more') state.lastTab = 'home';
        }
        return state as unknown as SettingsStore;
      },
    },
  ),
);
