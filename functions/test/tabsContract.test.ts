import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_TAB_KEYS, KNOWN_PICKER_KEYS, MAX_TOPICS } from '../src/notifications/tabsContract.ts';

/**
 * The tab-key snapshots that used to live here are gone. They asserted the
 * literal contents of the two arrays, which meant every legitimate tab change
 * required editing a test that proved nothing about correctness — and they
 * could not catch the case that actually hurts, because a missing key looks
 * identical to a key that was never supposed to exist.
 *
 * Both arrays are now generated from the crawler's categories artifact and
 * pinned by sha256 in `.contracts.lock.json`. CI compares the file against
 * that hash offline, so drift is caught by the harness rather than by a
 * hand-maintained copy of the same list.
 *
 * What stays here is what a hash cannot express: invariants that must hold
 * for ANY contents of those arrays.
 */

test('FIXED_TAB_KEYS와 KNOWN_PICKER_KEYS 교집합 없음 (한 탭이 두 모드 동시 X)', () => {
  // The generator rejects this too, but a cheap independent witness is worth
  // keeping: a key in both lists would make derive() emit two different topic
  // shapes for one tab.
  const fixedSet = new Set<string>(FIXED_TAB_KEYS);
  for (const key of KNOWN_PICKER_KEYS) {
    assert.ok(!fixedSet.has(key), `${key} should not be both fixed and picker`);
  }
});

test('두 배열 모두 비어 있지 않다', () => {
  // An empty picker set would silently disable every picker notification,
  // and an empty fixed set every fixed one — with no error anywhere.
  assert.ok(FIXED_TAB_KEYS.length > 0, 'no fixed tabs');
  assert.ok(KNOWN_PICKER_KEYS.length > 0, 'no picker tabs');
});

test('모든 tab key 가 FCM topic prefix 로 안전하다', () => {
  // A picker key IS its topic prefix ('dept' -> 'dept:<id>'), so a key holding
  // ':' or '/' would corrupt every topic string built from it, and FCM would
  // reject the send. Nothing checked this before.
  for (const key of [...FIXED_TAB_KEYS, ...KNOWN_PICKER_KEYS]) {
    assert.match(key, /^[a-z][a-z0-9]*$/, `${key} is not a safe topic prefix`);
  }
});

/**
 * Cross-repo cap contract (skkuverse-server#75 / that repo's ADR 0005).
 *
 * The server merges an article cross-posted to N boards into ONE call carrying
 * the union of their topics, so MAX_TOPICS must be >= the widest cross-post it
 * can produce. Setting it below the server's TOPIC_CAP makes the handler 400
 * those merged payloads, and the server retries them to permanent failure —
 * i.e. subscribers silently stop receiving cross-posted notices.
 *
 * The old `assert.equal(MAX_TOPICS, 30)` is gone. It was green in the state
 * that is actually dangerous — the server raising past this cap — because it
 * only ever looked at this side. That comparison now lives in the
 * `notices.topic-cap` contract, which checks the *relation*
 * (server TOPIC_CAP <= this value) against the real server file rather than a
 * hardcoded number. What is left here are the bounds that hold regardless of
 * what the server does.
 */
test('MAX_TOPICS covers the widest cross-post measured in prod (16-way dept)', () => {
  // skku_notices.notices, 2026-08-04: one 교직 notice on 16 college boards,
  // every one a `dept` picker source -> a 16-topic union in a single call.
  assert.ok(
    MAX_TOPICS >= 16,
    `MAX_TOPICS=${MAX_TOPICS} would truncate a 16-way cross-post and drop subscribers`,
  );
});

test('MAX_TOPICS 는 Firestore array-contains-any 한도를 넘지 않는다', () => {
  // The ceiling is not a preference — sendNotification queries devices with
  // array-contains-any, which Firestore caps at 30. Raising this to "fix" a
  // truncation would make the query itself throw. Previously only a comment
  // guarded this.
  assert.ok(
    MAX_TOPICS <= 30,
    `MAX_TOPICS=${MAX_TOPICS} exceeds Firestore's array-contains-any limit of 30`,
  );
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
