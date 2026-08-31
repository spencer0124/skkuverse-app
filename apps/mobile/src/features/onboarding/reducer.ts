import type { OnboardingAction, OnboardingState, OnboardingStep } from './types';

/**
 * State machine for the 7-step notices onboarding wizard.
 *
 * Lives in its own module, free of React Native imports, so it can run under
 * `node --experimental-strip-types --test`. The step-skipping rules below are
 * the part most worth testing: they are the only place the ladder is not a
 * plain +1/-1, and getting one wrong strands the user on a page that cannot
 * advance.
 *
 * Step ladder: 1 campus → 2 primary dept → 3 interest depts → 4 login →
 * 5 notification → 6 notice categories → 7 completion.
 *
 * The import above is type-only on purpose. `--experimental-strip-types` erases
 * it, which leaves this module with no relative runtime import for Node's ESM
 * resolver to choke on — the same property that makes `campusProximity.ts`
 * testable. Any value this file needs has to live here.
 */

/** Interest departments a user may pick on step 3, on top of their primary. */
export const MAX_INTEREST_DEPTS = 4;

export const initialState: OnboardingState = {
  step: 1,
  campus: null,
  primaryDeptId: null,
  interestDeptIds: [],
  userName: null,
  notificationsAccepted: null,
  seededPickerSelections: null,
  skipLogin: false,
};

export function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_CAMPUS':
      return { ...state, campus: action.campus };

    case 'SET_PRIMARY_DEPT':
      return {
        ...state,
        primaryDeptId: action.deptId,
        // Remove new primary from interest list if present
        interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
        // Invalidate cached picker (J1) — user edited dept after ACCEPT, finalize
        // must reassemble from fresh state to avoid Firestore↔local drift.
        seededPickerSelections: null,
      };

    case 'SKIP_PRIMARY_DEPT':
      // User tapped "내 학과가 없어요" → opened survey webview → dismissed.
      // primary null로 마킹. interest는 보존 (이후 step에서 picking 가능).
      return { ...state, primaryDeptId: null, seededPickerSelections: null };

    case 'TOGGLE_INTEREST_DEPT': {
      const exists = state.interestDeptIds.includes(action.deptId);
      if (exists) {
        return {
          ...state,
          interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
          seededPickerSelections: null,
        };
      }
      if (state.interestDeptIds.length >= MAX_INTEREST_DEPTS) return state;
      return {
        ...state,
        interestDeptIds: [...state.interestDeptIds, action.deptId],
        seededPickerSelections: null,
      };
    }

    case 'CLEAR_INTEREST_DEPTS':
      return { ...state, interestDeptIds: [], seededPickerSelections: null };

    case 'SET_USER':
      return { ...state, userName: action.name };

    case 'ACCEPT_NOTIFICATIONS':
      return {
        ...state,
        notificationsAccepted: true,
        seededPickerSelections: action.pickerSelections,
      };

    case 'DECLINE_NOTIFICATIONS':
      return { ...state, notificationsAccepted: false };

    case 'NEXT':
      if (state.step >= 7) return state;
      // Already signed in (the first-launch intro, or any other entrypoint,
      // got there first) → jump the login page. Asking a user to sign in to
      // the account they are already on reads as a bug.
      if (state.step === 3 && state.skipLogin) return { ...state, step: 5 };
      return { ...state, step: (state.step + 1) as OnboardingStep };

    case 'PREV':
      if (state.step <= 1) return state;
      // Declined 경로는 step 7에서 PREV 시 step 6를 스킵하고 step 5로 점프.
      // 카테고리 페이지(step 6)는 ACCEPT 경로에서만 의미가 있고, declined 상태로
      // 진입하면 seed가 안 됐으므로 토글이 silent fail.
      if (state.step === 7 && state.notificationsAccepted === false) {
        return { ...state, step: 5 };
      }
      // Mirror of the NEXT skip — without it, back from 5 lands on the login
      // page the user never saw.
      if (state.step === 5 && state.skipLogin) return { ...state, step: 3 };
      return { ...state, step: (state.step - 1) as OnboardingStep };

    default:
      return state;
  }
}
