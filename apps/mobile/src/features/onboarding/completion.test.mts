import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decideOnboardingCompletion } from './completion.ts';

describe('decideOnboardingCompletion', () => {
  test('accepted notifications + uid → finalize', () => {
    assert.equal(
      decideOnboardingCompletion({ uid: 'u1', notificationsAccepted: true }),
      'finalize',
    );
  });

  test('declined notifications + uid → seed-declined', () => {
    assert.equal(
      decideOnboardingCompletion({ uid: 'u1', notificationsAccepted: false }),
      'seed-declined',
    );
  });

  test('null notificationsAccepted + uid → seed-declined (only true means accepted)', () => {
    assert.equal(
      decideOnboardingCompletion({ uid: 'u1', notificationsAccepted: null }),
      'seed-declined',
    );
  });

  // 이 케이스가 유령 상태(ghost) 방지의 핵심이다.
  //
  // 예전 handleComplete 은 uid 가 없으면 로그만 남기고 completeOnboarding()
  // 으로 그대로 흘러내려갔다 — MMKV 는 "온보딩 완료", Firestore 에는 문서
  // 없음. 그 상태에서 학과 picker 의 update() 는 영구히 실패한다 (2026-07,
  // 2026-09). 'abort-no-uid' 는 호출자가 완료 게이트를 열지 말고 사용자에게
  // 재시도를 요구해야 한다는 뜻이다.
  test('no uid → abort-no-uid (never mint a ghost)', () => {
    assert.equal(
      decideOnboardingCompletion({ uid: null, notificationsAccepted: true }),
      'abort-no-uid',
    );
    assert.equal(
      decideOnboardingCompletion({ uid: '', notificationsAccepted: false }),
      'abort-no-uid',
    );
    assert.equal(
      decideOnboardingCompletion({ uid: undefined, notificationsAccepted: null }),
      'abort-no-uid',
    );
  });

  test('uid presence dominates the notification choice', () => {
    // 알림 수락 여부와 무관하게 uid 가 없으면 항상 중단.
    for (const accepted of [true, false, null]) {
      assert.equal(
        decideOnboardingCompletion({ uid: null, notificationsAccepted: accepted }),
        'abort-no-uid',
      );
    }
  });
});
