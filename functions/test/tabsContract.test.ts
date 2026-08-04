import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_TAB_KEYS, KNOWN_PICKER_KEYS, MAX_TOPICS } from '../src/notifications/tabsContract.ts';

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

/**
 * Cross-repo cap contract (skkuverse-server#75 / that repo's ADR 0005).
 *
 * The server merges an article cross-posted to N boards into ONE call carrying
 * the union of their topics, so MAX_TOPICS must be >= the widest cross-post it
 * can produce. Lowering this below the server's TOPIC_CAP makes the handler
 * 400 those merged payloads, and the server retries them to permanent failure —
 * i.e. subscribers silently stop receiving cross-posted notices.
 */
test('MAX_TOPICS matches skkuverse-server TOPIC_CAP (notices.topics.ts)', () => {
  assert.equal(MAX_TOPICS, 30);
});

test('MAX_TOPICS covers the widest cross-post measured in prod (16-way dept)', () => {
  // skku_notices.notices, 2026-08-04: one 교직 notice on 16 college boards,
  // every one a `dept` picker source -> a 16-topic union in a single call.
  assert.ok(
    MAX_TOPICS >= 16,
    `MAX_TOPICS=${MAX_TOPICS} would truncate a 16-way cross-post and drop subscribers`,
  );
});
