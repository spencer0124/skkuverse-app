import type { Campus } from '@skkuverse/shared';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface OnboardingState {
  step: OnboardingStep;
  campus: Campus | null;
  primaryDeptId: string | null;
  interestDeptIds: string[];
  userName: string | null;
}

export type OnboardingAction =
  | { type: 'SET_CAMPUS'; campus: Campus }
  | { type: 'SET_PRIMARY_DEPT'; deptId: string }
  | { type: 'TOGGLE_INTEREST_DEPT'; deptId: string }
  | { type: 'CLEAR_INTEREST_DEPTS' }
  | { type: 'SET_USER'; name: string }
  | { type: 'NEXT' }
  | { type: 'PREV' };

export const MAX_INTEREST_DEPTS = 4;
export const TOTAL_STEPS = 6;
