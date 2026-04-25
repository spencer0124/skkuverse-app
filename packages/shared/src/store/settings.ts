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
  /** Whether the user has completed the onboarding flow. */
  onboardingCompleted: boolean;
  /** Primary department chosen during onboarding (temporary — promotes to Firestore preferences on completion). */
  primaryDeptId: string | null;
  /** Interest departments chosen during onboarding, max 3 (temporary — promotes to Firestore preferences on completion). */
  interestDeptIds: string[];
}

interface SettingsActions {
  setPreferredCampus: (campus: Campus) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setLastTab: (tab: TabRoute) => void;
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
 * v3 → v4 migration: pickerSelections / setPickerSelection removed.
 *   The picker selection state moved to Firestore (preferences/main →
 *   pickerSelections) as part of the v5 SSOT redesign so picks sync
 *   across devices. Local stale data is dropped silently on hydration.
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      preferredCampus: 'hssc',
      appLanguage: 'ko',
      lastTab: 'notices',
      onboardingCompleted: false,
      primaryDeptId: null,
      interestDeptIds: [],

      setPreferredCampus: (campus) => set({ preferredCampus: campus }),
      setAppLanguage: (language) => set({ appLanguage: language }),
      setLastTab: (tab) => set({ lastTab: tab }),
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
      version: 4,
      storage: createJSONStorage(() => mmkvStateStorage),
      migrate: (persisted, version) => {
        const state = { ...(persisted as Record<string, unknown>) };
        if (version === 0) {
          // v0 → v1: selectedDeptIds/selectedLibIds → pickerSelections.
          // pickerSelections itself is dropped in v4 below; just clean up
          // the legacy field names here so v4 sees a consistent shape.
          delete state.selectedDeptIds;
          delete state.selectedLibIds;
          delete state.setSelectedDeptIds;
          delete state.setSelectedLibIds;
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
        if ((version ?? 0) < 4) {
          // pickerSelections moved to Firestore (v5 SSOT). Drop local copy.
          delete state.pickerSelections;
          delete state.setPickerSelection;
        }
        return state as unknown as SettingsStore;
      },
    },
  ),
);
