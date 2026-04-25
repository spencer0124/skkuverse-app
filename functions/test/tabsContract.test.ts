import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_TAB_KEYS, KNOWN_PICKER_KEYS } from '../src/notifications/tabsContract.ts';

/**
 * Snapshot test against skkuverse-server `categories.json` ground truth.
 * Fails on any drift (additions, removals, renames).
 *
 * If a tab is added/removed in backend, update this expected list intentionally
 * — the test failure is the safety net.
 */

test('FIXED_TAB_KEYS matches skkuverse-server categories.json fixed entries', () => {
  // skkuverse-server/features/notices/categories.json:
  // tabMode='fixed' entries (in declaration order)
  const expected = ['academic', 'scholarship', 'career', 'recruitment', 'event'];
  assert.deepEqual([...FIXED_TAB_KEYS], expected);
});

test('KNOWN_PICKER_KEYS matches skkuverse-server categories.json picker entries', () => {
  // skkuverse-server/features/notices/categories.json:
  // tabMode='picker' entries (in declaration order)
  const expected = ['dept', 'library', 'dorm', 'general'];
  assert.deepEqual([...KNOWN_PICKER_KEYS], expected);
});

test('FIXED_TAB_KEYS와 KNOWN_PICKER_KEYS 교집합 없음 (한 탭이 두 모드 동시 X)', () => {
  const fixedSet = new Set<string>(FIXED_TAB_KEYS);
  for (const key of KNOWN_PICKER_KEYS) {
    assert.ok(!fixedSet.has(key), `${key} should not be both fixed and picker`);
  }
});

test('합쳐서 9개 탭 (server categories.json와 일치)', () => {
  assert.equal(FIXED_TAB_KEYS.length + KNOWN_PICKER_KEYS.length, 9);
});
