import type { Campus } from '@skkuverse/shared';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OnboardingState {
  step: OnboardingStep;
  campus: Campus | null;
  primaryDeptId: string | null;
  interestDeptIds: string[];
  userName: string | null;
  // null = step 5 미통과, true = "받을게요" → step 6 카테고리 진입, false = "안 받을게요" → step 6 스킵
  notificationsAccepted: boolean | null;
  // prepareCategoryStep에서 조립한 picker selections를 finalize 시 동일하게 재사용.
  // assemble을 두 번 호출하면 tabsConfig race에 노출되므로 reducer state로 stash.
  seededPickerSelections: Record<string, string[]> | null;
  /**
   * Frozen at mount: the user was already signed in when the wizard opened, so
   * step 4 (login) is skipped in both directions. Set from authStore in the
   * lazy initializer — deliberately NOT read live, since signing in mid-wizard
   * would otherwise change the ladder underneath the user.
   */
  skipLogin: boolean;
}

export type OnboardingAction =
  | { type: 'SET_CAMPUS'; campus: Campus }
  | { type: 'SET_PRIMARY_DEPT'; deptId: string }
  | { type: 'SKIP_PRIMARY_DEPT' }
  | { type: 'TOGGLE_INTEREST_DEPT'; deptId: string }
  | { type: 'CLEAR_INTEREST_DEPTS' }
  | { type: 'SET_USER'; name: string }
  | { type: 'ACCEPT_NOTIFICATIONS'; pickerSelections: Record<string, string[]> }
  | { type: 'DECLINE_NOTIFICATIONS' }
  | { type: 'NEXT' }
  | { type: 'PREV' };
