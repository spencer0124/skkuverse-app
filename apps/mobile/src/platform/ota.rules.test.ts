import { expect, test } from 'vitest';
import { EMBEDDED_BUNDLE, PRERELEASE_GATES, isPrerelease, resolveOtaId } from './ota.rules';

const MIN = '00000000-0000-0000-0000-000000000000';
const OTA = '0199b6a4-3c2e-7d41-9a8b-1f2e3d4c5b6a';

test('the built-in bundle is embedded, whether named by MIN_BUNDLE_ID or missing', () => {
  expect(resolveOtaId(MIN, MIN)).toBe(EMBEDDED_BUNDLE);
  expect(resolveOtaId('', MIN)).toBe(EMBEDDED_BUNDLE);
  expect(resolveOtaId(null, MIN)).toBe(EMBEDDED_BUNDLE);
  expect(resolveOtaId(undefined, MIN)).toBe(EMBEDDED_BUNDLE);
});

test('an OTA bundle is reported by its full id, which starts with the old 8-character value', () => {
  expect(resolveOtaId(OTA, MIN)).toBe(OTA);
  expect(resolveOtaId(OTA, MIN).startsWith(OTA.slice(0, 8))).toBe(true);
  // Within Firebase's 100-character param value limit.
  expect(resolveOtaId(OTA, MIN).length <= 100).toBe(true);
});

// The one rule for every unreleased product feature: on in a development
// build and on the beta channel, off in production and on any channel it does
// not expect.
test('a development build is prerelease on any channel', () => {
  // Arrange
  const channels = ['production', 'beta', ''];
  // Act
  const results = channels.map((channel) => isPrerelease(true, channel));
  // Assert
  expect(results).toEqual([true, true, true]);
});

test('a release build is prerelease on the beta channel alone', () => {
  // Arrange
  const cases: [string, boolean][] = [
    ['beta', true],
    ['production', false],
    ['staging', false],
    ['', false],
  ];
  for (const [channel, expected] of cases) {
    // Act
    const prerelease = isPrerelease(false, channel);
    // Assert
    expect(prerelease, channel).toBe(expected);
  }
});

// The one list of what a store build leaves out. Adding or releasing a gate is
// a decision, so it changes this test on purpose.
test('the gates are exactly the features a store build leaves out', () => {
  // Act
  const gates = [...PRERELEASE_GATES].sort();
  // Assert
  expect(gates).toStrictEqual(['buildingCounts', 'directionsChips', 'noticeSearchOverview', 'thisWeekPage', 'thisWeekSheet']);
});
