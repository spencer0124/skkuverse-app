import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '../settings';

// Mock react-native-mmkv: native 모듈이라 Node 환경에서 import 자체가 실패.
// vi.mock은 vitest가 자동 hoist하므로 import 뒤에 둬도 적용 시점이 import
// 평가 전 — eslint import/first 경고 회피하면서 동일 효과.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

const initialState = {
  preferredCampus: 'hssc' as const,
  appLanguage: 'ko' as const,
  lastTab: 'notices' as const,
  onboardingCompleted: false,
  primaryDeptId: null,
  interestDeptIds: [],
};

describe('useSettingsStore.restoreOnboardingFromRemote', () => {
  beforeEach(() => {
    // Reset state fields to default. Note: NOT replace=true — that would
    // also wipe the action functions registered in store definition.
    useSettingsStore.setState(initialState);
  });

  it('fresh restore: sets primaryDept/interest + onboardingCompleted=true', () => {
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'cs',
      interestDeptIds: ['ee', 'me'],
    });
    const s = useSettingsStore.getState();
    expect(s.onboardingCompleted).toBe(true);
    expect(s.primaryDeptId).toBe('cs');
    expect(s.interestDeptIds).toEqual(['ee', 'me']);
  });

  it('dual-write race-free: same data twice → final state identical', () => {
    // 본 PR 시나리오 E — 인라인 핸들러 호출 + listener 발화의 중복 호출.
    const data = { primaryDeptId: 'cs', interestDeptIds: ['ee'] };
    useSettingsStore.getState().restoreOnboardingFromRemote(data);
    useSettingsStore.getState().restoreOnboardingFromRemote(data);
    const s = useSettingsStore.getState();
    expect(s.onboardingCompleted).toBe(true);
    expect(s.primaryDeptId).toBe('cs');
    expect(s.interestDeptIds).toEqual(['ee']);
  });

  it('account-switch: always-overwrite replaces previous values', () => {
    // 본 PR 시나리오 F — A 로그인 → logout → B 단축경로. idempotency
    // guard가 있었다면 A의 'cs'가 sticky하게 남음 (silent breach).
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'cs',
      interestDeptIds: ['ee'],
    });
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'mech',
      interestDeptIds: ['me', 'ie'],
    });
    const s = useSettingsStore.getState();
    expect(s.primaryDeptId).toBe('mech');
    expect(s.interestDeptIds).toEqual(['me', 'ie']);
  });

  it('does not touch preferredCampus / appLanguage / lastTab', () => {
    // campus는 의도적 미복원 (plan §캠퍼스 미복원 정당화).
    // appLanguage / lastTab도 사용자가 명시 설정한 다른 도메인의 값이라
    // restore가 손대면 안 됨.
    useSettingsStore.getState().setPreferredCampus('nsc');
    useSettingsStore.getState().setAppLanguage('en');
    useSettingsStore.getState().setLastTab('home');

    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'cs',
      interestDeptIds: [],
    });

    const s = useSettingsStore.getState();
    expect(s.preferredCampus).toBe('nsc');
    expect(s.appLanguage).toBe('en');
    expect(s.lastTab).toBe('home');
    expect(s.onboardingCompleted).toBe(true);
    expect(s.primaryDeptId).toBe('cs');
  });
});
