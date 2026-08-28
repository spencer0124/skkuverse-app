/**
 * Onboarding wizard step machine.
 *
 * NOTE: apps/mobile runs `node --test` over `src/**\/*.test.mts`, a DIFFERENT
 * runner from packages/shared's vitest. `reducer.ts` imports only `./types`,
 * whose sole import is `import type { Campus }` — `--experimental-strip-types`
 * erases it, so the module loads under plain Node with no React Native.
 *
 * The ladder is 1 campus → 2 primary dept → 3 interest depts → 4 login →
 * 5 notification → 6 categories → 7 completion. Only three transitions are not
 * a plain ±1, and all three are covered here: they are the ones that can strand
 * a user on a page with no way forward.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reducer } from './reducer.ts';
import type { OnboardingState, OnboardingStep } from './types.ts';

function at(step: OnboardingStep, overrides: Partial<OnboardingState> = {}): OnboardingState {
  return { ...initialState, step, ...overrides };
}

describe('reducer — login step skip', () => {
  it('NEXT from 3 lands on 4 when the user is not signed in', () => {
    assert.equal(reducer(at(3), { type: 'NEXT' }).step, 4);
  });

  it('NEXT from 3 jumps to 5 when the user is already signed in', () => {
    assert.equal(reducer(at(3, { skipLogin: true }), { type: 'NEXT' }).step, 5);
  });

  it('PREV from 5 lands on 4 when the user is not signed in', () => {
    assert.equal(reducer(at(5), { type: 'PREV' }).step, 4);
  });

  it('PREV from 5 jumps back to 3 when the login page was skipped', () => {
    // Without this mirror, back from the notification page lands on a login
    // page the user never saw and does not need.
    assert.equal(reducer(at(5, { skipLogin: true }), { type: 'PREV' }).step, 3);
  });

  it('leaves every other transition alone', () => {
    const skipping = { skipLogin: true };
    assert.equal(reducer(at(1, skipping), { type: 'NEXT' }).step, 2);
    assert.equal(reducer(at(2, skipping), { type: 'NEXT' }).step, 3);
    assert.equal(reducer(at(5, skipping), { type: 'NEXT' }).step, 6);
    assert.equal(reducer(at(6, skipping), { type: 'NEXT' }).step, 7);
    assert.equal(reducer(at(3, skipping), { type: 'PREV' }).step, 2);
    assert.equal(reducer(at(6, skipping), { type: 'PREV' }).step, 5);
  });
});

describe('reducer — declined-notifications skip', () => {
  it('PREV from 7 jumps to 5, bypassing the unseeded category page', () => {
    const state = at(7, { notificationsAccepted: false });
    assert.equal(reducer(state, { type: 'PREV' }).step, 5);
  });

  it('PREV from 7 lands on 6 when notifications were accepted', () => {
    const state = at(7, { notificationsAccepted: true });
    assert.equal(reducer(state, { type: 'PREV' }).step, 6);
  });

  it('is not shadowed by the login skip — both can be active at once', () => {
    // A user who signed in via the intro AND declined notifications takes both
    // detours: 7 → 5 here, then 5 → 3 on the next PREV.
    const state = at(7, { notificationsAccepted: false, skipLogin: true });
    const back = reducer(state, { type: 'PREV' });
    assert.equal(back.step, 5);
    assert.equal(reducer(back, { type: 'PREV' }).step, 3);
  });
});

describe('reducer — clamping', () => {
  it('NEXT does not advance past the last step', () => {
    assert.equal(reducer(at(7), { type: 'NEXT' }).step, 7);
    assert.equal(reducer(at(7, { skipLogin: true }), { type: 'NEXT' }).step, 7);
  });

  it('PREV does not retreat past the first step', () => {
    assert.equal(reducer(at(1), { type: 'PREV' }).step, 1);
    assert.equal(reducer(at(1, { skipLogin: true }), { type: 'PREV' }).step, 1);
  });
});

describe('reducer — skipLogin is inert outside navigation', () => {
  it('survives the selection actions untouched', () => {
    // The flag is frozen at mount; nothing in the wizard may recompute it.
    let state = at(1, { skipLogin: true });
    state = reducer(state, { type: 'SET_CAMPUS', campus: 'hssc' });
    state = reducer(state, { type: 'SET_PRIMARY_DEPT', deptId: 'cs' });
    state = reducer(state, { type: 'TOGGLE_INTEREST_DEPT', deptId: 'ee' });
    state = reducer(state, { type: 'SET_USER', name: '홍길동' });
    assert.equal(state.skipLogin, true);
  });
});
