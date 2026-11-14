import { describe, expect, test } from 'vitest';
import {
  createKeyedSingleFlight,
  enabledAfterOnboardingDecline,
  isMiniAppPushOn,
  miniAppSubscriptionMutation,
  optInsToReapply,
  shouldQueryPermissionAtLaunch,
} from './miniapp-push.rules';
import { activeMiniAppOptIns, hasMiniAppPush, hasMiniAppPushToggle } from './notifications.constants';

const fv = {
  arrayUnion: (v: string) => ({ op: 'union', v }),
  arrayRemove: (v: string) => ({ op: 'remove', v }),
};

describe('miniAppSubscriptionMutation', () => {
  // C4: one write, so the two fields can never be derived out of order.
  test('turning on writes the master switch and the id in ONE mutation', () => {
    expect(miniAppSubscriptionMutation('eskara-2026', true, fv)).toStrictEqual({
      enabled: true,
      miniAppSelections: { op: 'union', v: 'eskara-2026' },
    });
  });

  // Turning a mini app off must not turn notices off with it.
  test('turning off removes the id and leaves the master switch alone', () => {
    expect(miniAppSubscriptionMutation('eskara-2026', false, fv)).toStrictEqual({
      miniAppSelections: { op: 'remove', v: 'eskara-2026' },
    });
  });
});

describe('optInsToReapply — the device choice follows a uid change', () => {
  test('first sign-in of the session (no previous uid): nothing', () => {
    expect(optInsToReapply({ prevUid: null, uid: 'a', optIns: ['eskara-2026'] })).toStrictEqual([]);
  });

  // C1: linkWithCredential keeps the uid, so the prefs doc is already right.
  test('same uid (anonymous linked to Google): nothing', () => {
    expect(optInsToReapply({ prevUid: 'a', uid: 'a', optIns: ['eskara-2026'] })).toStrictEqual([]);
  });

  // C1': credential-already-in-use falls back to signIn → a different uid.
  test('uid changed: every opt-in is written again under the new uid', () => {
    expect(optInsToReapply({ prevUid: 'anon', uid: 'google', optIns: ['eskara-2026', 'inja'] })).toStrictEqual(['eskara-2026', 'inja']);
  });

  test('uid changed but this device opted into nothing: nothing', () => {
    expect(optInsToReapply({ prevUid: 'anon', uid: 'google', optIns: [] })).toStrictEqual([]);
  });

  test('signed out to nothing (no uid yet): nothing', () => {
    expect(optInsToReapply({ prevUid: 'google', uid: null, optIns: ['eskara-2026'] })).toStrictEqual([]);
  });
});

describe('enabledAfterOnboardingDecline (C2)', () => {
  test('no mini-app subscription: decline turns the master switch off, as before', () => {
    expect(enabledAfterOnboardingDecline({ miniAppSelections: undefined, optIns: [] })).toBe(false);
    expect(enabledAfterOnboardingDecline({ miniAppSelections: [], optIns: [] })).toBe(false);
  });

  test('subscribed on the server: the master switch stays on, only notices go off', () => {
    expect(enabledAfterOnboardingDecline({ miniAppSelections: ['eskara-2026'], optIns: [] })).toBe(true);
  });

  // The listener may not have delivered the doc yet; the device record decides.
  test('opted in on this device but the snapshot has not arrived: stays on', () => {
    expect(enabledAfterOnboardingDecline({ miniAppSelections: undefined, optIns: ['eskara-2026'] })).toBe(true);
  });
});

describe('isMiniAppPushOn — what the toggle shows (C8)', () => {
  const on = { enabled: true, miniAppSelections: ['eskara-2026'] };

  test('subscribed, master on, OS permission granted', () => {
    expect(isMiniAppPushOn(on, 'eskara-2026', 'authorized')).toBe(true);
    expect(isMiniAppPushOn(on, 'eskara-2026', 'provisional')).toBe(true);
  });

  test('OS permission revoked or never granted: off, whatever the server says', () => {
    expect(isMiniAppPushOn(on, 'eskara-2026', 'denied')).toBe(false);
    expect(isMiniAppPushOn(on, 'eskara-2026', 'notDetermined')).toBe(false);
  });

  test('master switch off: off — derive would emit no topic', () => {
    expect(isMiniAppPushOn({ ...on, enabled: false }, 'eskara-2026', 'authorized')).toBe(false);
  });

  test('another mini app, or a doc predating the field: off', () => {
    expect(isMiniAppPushOn(on, 'inja', 'authorized')).toBe(false);
    expect(isMiniAppPushOn({ enabled: true }, 'eskara-2026', 'authorized')).toBe(false);
  });
});

describe('createKeyedSingleFlight (C3)', () => {
  test('concurrent calls for one key share a single run', async () => {
    const flight = createKeyedSingleFlight<string>();
    let runs = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const fn = async () => {
      runs++;
      await gate;
      return 'seeded';
    };
    const a = flight('uid-1', fn);
    const b = flight('uid-1', fn);
    release();
    expect(await Promise.all([a, b])).toStrictEqual(['seeded', 'seeded']);
    expect(runs).toBe(1);
  });

  test('different keys run independently', async () => {
    const flight = createKeyedSingleFlight<number>();
    let runs = 0;
    await Promise.all([
      flight('a', async () => ++runs),
      flight('b', async () => ++runs),
    ]);
    expect(runs).toBe(2);
  });

  test('a finished run is not reused — the next call runs afresh', async () => {
    const flight = createKeyedSingleFlight<number>();
    let runs = 0;
    await flight('a', async () => ++runs);
    await flight('a', async () => ++runs);
    expect(runs).toBe(2);
  });

  test('a failed run is released, and its error reaches every waiter', async () => {
    const flight = createKeyedSingleFlight<number>();
    let runs = 0;
    const boom = async () => {
      runs++;
      throw new Error('boom');
    };
    await Promise.all([
      expect(flight('a', boom)).rejects.toThrow(/boom/),
      expect(flight('a', boom)).rejects.toThrow(/boom/),
    ]);
    expect(runs).toBe(1);
    expect(await flight('a', async () => 7)).toBe(7);
  });
});

describe('shouldQueryPermissionAtLaunch — the launch-time re-registration (self-heal)', () => {
  test('onboarded and answered once: yes, as before', () => {
    expect(shouldQueryPermissionAtLaunch({ onboardingCompleted: true, persistedStatus: 'authorized', optIns: [] })).toBe(true);
  });

  test('onboarding deferred the permission ("다음에 할게요"): never prompt at launch', () => {
    expect(shouldQueryPermissionAtLaunch({ onboardingCompleted: true, persistedStatus: 'notDetermined', optIns: [] })).toBe(false);
    expect(shouldQueryPermissionAtLaunch({
        onboardingCompleted: false,
        persistedStatus: 'notDetermined',
        optIns: ['eskara-2026'],
      })).toBe(false);
  });

  // C6: an anonymous festival subscriber re-registers every launch like an
  // onboarded user, so a stale device replica heals on the next launch.
  test('not onboarded but opted into a mini app: yes', () => {
    expect(shouldQueryPermissionAtLaunch({
        onboardingCompleted: false,
        persistedStatus: 'authorized',
        optIns: ['eskara-2026'],
      })).toBe(true);
  });

  test('not onboarded, no opt-in: no, as before', () => {
    expect(shouldQueryPermissionAtLaunch({ onboardingCompleted: false, persistedStatus: 'authorized', optIns: [] })).toBe(false);
  });
});

describe('hasMiniAppPush — which mini apps show the subscription toggle', () => {
  const during = Date.parse('2026-10-02T22:00:00+09:00');
  const after = Date.parse('2026-10-03T00:00:00+09:00');
  test('ESKARA 2026 pushes during its window', () => {
    expect(hasMiniAppPush('eskara-2026', during)).toBe(true);
  });
  test('mini apps that never push get no toggle', () => {
    expect(hasMiniAppPush('inja', during)).toBe(false);
    expect(hasMiniAppPush(undefined, during)).toBe(false);
    expect(hasMiniAppPush('', during)).toBe(false);
  });
  test('ESKARA 2026 shows no toggle once its window closes (an issue outside this repository, D7)', () => {
    // Arrange
    const reverified = Date.parse('2026-10-22T12:00:00+09:00');

    // Act & Assert
    expect(hasMiniAppPush('eskara-2026', after)).toBe(false);
    expect(hasMiniAppPush('eskara-2026', reverified)).toBe(false);
  });
});

describe('hasMiniAppPushToggle — the switch stays while it is the way off (an issue outside this repository, D7)', () => {
  const during = Date.parse('2026-10-02T22:00:00+09:00');
  const after = Date.parse('2026-10-03T00:00:00+09:00');

  test.each([
    ['inside the window, not receiving', during, false, true],
    ['inside the window, receiving', during, true, true],
    ['after the window, still receiving, so it can be turned off', after, true, true],
    ['after the window, not receiving', after, false, false],
  ])('ESKARA 2026 %s', (_case, now, receives, expected) => {
    // Act & Assert
    expect(hasMiniAppPushToggle('eskara-2026', now, receives)).toBe(expected);
  });

  test('a mini app that never pushes gets no toggle, whatever the device says', () => {
    // Act & Assert
    expect(hasMiniAppPushToggle('inja', during, true)).toBe(false);
    expect(hasMiniAppPushToggle(undefined, during, true)).toBe(false);
  });
});

describe('activeMiniAppOptIns — an opt-in stops mattering when its festival ends (N4)', () => {
  const during = Date.parse('2026-10-02T22:00:00+09:00');
  const after = Date.parse('2026-10-03T00:00:00+09:00');
  test('keeps pushing mini apps during their window', () => {
    expect(activeMiniAppOptIns(['eskara-2026'], during)).toStrictEqual(['eskara-2026']);
  });
  test('drops them once the window closes, and drops ids that never push', () => {
    expect(activeMiniAppOptIns(['eskara-2026'], after)).toStrictEqual([]);
    expect(activeMiniAppOptIns(['inja', 'eskara-2026'], during)).toStrictEqual(['eskara-2026']);
  });
});
