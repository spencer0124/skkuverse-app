// Firestore security rules tests — Task #12 (devices/{deviceId} auth transition).
//
// Covers the scenarios enumerated in docs/plans/agile-wishing-shell.md STEP 4
// and codifies the expected behavior of the relaxed update rule:
//
//   allow update: if request.auth != null
//                 && request.resource.data.uid == request.auth.uid
//                 && (resource.data.uid == request.auth.uid
//                     || resource.data.active == false);
//
// ──────────────────────────────────────────────────────────────────────
// PREREQS (one-time):
//   yarn add -D -W @firebase/rules-unit-testing firebase
//   firebase-tools installed (JDK 21+ required for v15+ of the Firestore emulator)
//
// RUN (from repo root):
//   firebase emulators:exec --only firestore \
//     "node --test apps/mobile/firestore.rules.test.mjs"
//
// Uses Node 20+'s built-in `node:test` runner — no jest required.
// Uses @firebase/rules-unit-testing v5's compat-SDK chain API (the harness
// returns a compat Firestore instance; modular imports from
// `firebase/firestore` reject it on brand check).
// ──────────────────────────────────────────────────────────────────────

import { test, describe, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(__dirname, 'firestore.rules');

const PROJECT_ID = 'skkuverse-rules-test';
const DEVICE_ID = 'device-abc-123';
const COLLECTION = 'devices';

// Device doc template — every field DeviceDocument requires.
const deviceDoc = (overrides = {}) => ({
  uid: 'default-uid',
  token: 'fcm-token-placeholder',
  platform: 'ios',
  appVersion: '3.5.1',
  lastActive: new Date(),
  active: true,
  subscribedTopics: ['notice-all'],
  notificationsEnabled: false,
  locale: 'ko',
  ...overrides,
});

const deviceRef = (ctx) =>
  ctx.firestore().collection(COLLECTION).doc(DEVICE_ID);

let testEnv;

// File-level lifecycle — shared by all describe blocks below so we don't
// destroy the environment between them.
before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

describe('devices/{deviceId} rules — Task #12', () => {
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // ── CREATE ──────────────────────────────────────────────────────

  test('anon user creates own device doc → allow', async () => {
    const ctx = testEnv.authenticatedContext('anon-uid-1');
    await assertSucceeds(deviceRef(ctx).set(deviceDoc({ uid: 'anon-uid-1' })));
  });

  test('Google user creates own device doc → allow', async () => {
    const ctx = testEnv.authenticatedContext('google-uid-1');
    await assertSucceeds(deviceRef(ctx).set(deviceDoc({ uid: 'google-uid-1' })));
  });

  test("user creates doc with someone else's uid field → deny", async () => {
    const ctx = testEnv.authenticatedContext('attacker-uid');
    await assertFails(deviceRef(ctx).set(deviceDoc({ uid: 'victim-uid' })));
  });

  // ── UPDATE: path (a) — own doc, normal re-registration ─────────

  test('anon owner updates own active doc → allow', async () => {
    const ctx = testEnv.authenticatedContext('anon-uid-1');
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'anon-uid-1' }));
    });
    await assertSucceeds(
      deviceRef(ctx).set(
        deviceDoc({ uid: 'anon-uid-1', token: 'refreshed-token' }),
        { merge: true },
      ),
    );
  });

  test('owner flips own doc active=true → active=false (unregister) → allow', async () => {
    const ctx = testEnv.authenticatedContext('google-uid-1');
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'google-uid-1', active: true }));
    });
    await assertSucceeds(
      deviceRef(ctx).set(
        deviceDoc({ uid: 'google-uid-1', active: false }),
        { merge: true },
      ),
    );
  });

  // ── UPDATE: path (b) — claim an inactive doc left by previous owner ──

  // ⭐ The core Task #12 scenario: after Google→anon sign-out cycle, the
  //    new anon uid must be able to claim the now-inactive doc.
  test('new anon uid claims inactive doc (prev Google owner) → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'google-uid-1', active: false }));
    });

    const newAnonCtx = testEnv.authenticatedContext('new-anon-uid');
    await assertSucceeds(
      deviceRef(newAnonCtx).set(
        deviceDoc({
          uid: 'new-anon-uid',
          token: 'new-token',
          active: true,
        }),
        { merge: true },
      ),
    );
  });

  test('Google uid claims inactive doc (prev anon owner) → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'anon-uid-old', active: false }));
    });
    const googleCtx = testEnv.authenticatedContext('google-uid-1');
    await assertSucceeds(
      deviceRef(googleCtx).set(
        deviceDoc({ uid: 'google-uid-1', active: true }),
        { merge: true },
      ),
    );
  });

  // ── UPDATE: DENY cases — the security boundary the relaxation must preserve ─

  test("Google user A tries to claim Google user B's ACTIVE doc → deny", async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'google-uid-victim', active: true }));
    });
    const attackerCtx = testEnv.authenticatedContext('google-uid-attacker');
    await assertFails(
      deviceRef(attackerCtx).set(
        deviceDoc({ uid: 'google-uid-attacker', active: true }),
        { merge: true },
      ),
    );
  });

  test("anon C tries to claim anon D's ACTIVE doc → deny", async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'anon-D', active: true }));
    });
    const ctx = testEnv.authenticatedContext('anon-C');
    await assertFails(
      deviceRef(ctx).set(
        deviceDoc({ uid: 'anon-C', active: true }),
        { merge: true },
      ),
    );
  });

  test('user writes uid field mismatched to their auth.uid (spoof attempt) → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'some-uid', active: false }));
    });
    const ctx = testEnv.authenticatedContext('caller-uid');
    await assertFails(
      deviceRef(ctx).set(
        deviceDoc({ uid: 'spoofed-uid', active: true }),
        { merge: true },
      ),
    );
  });

  // ── READ ─────────────────────────────────────────────────────────

  test('owner reads own doc → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'google-uid-1' }));
    });
    const ctx = testEnv.authenticatedContext('google-uid-1');
    await assertSucceeds(deviceRef(ctx).get());
  });

  test('non-owner reads doc → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'owner-uid' }));
    });
    const ctx = testEnv.authenticatedContext('other-uid');
    await assertFails(deviceRef(ctx).get());
  });

  // ── DELETE ───────────────────────────────────────────────────────

  test('any authenticated user attempts delete → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .collection(COLLECTION)
        .doc(DEVICE_ID)
        .set(deviceDoc({ uid: 'any-uid' }));
    });
    const ctx = testEnv.authenticatedContext('any-uid');
    await assertFails(deviceRef(ctx).delete());
  });
});

// ── users/{uid}/preferences/main rules — Phase F SSOT lockdown ───────────────

const prefsRef = (ctx, uid) =>
  ctx.firestore().doc(`users/${uid}/preferences/main`);

const intentDoc = (overrides = {}) => ({
  enabled: false,
  // essential 은 항상 true (UI lock + CF derive override + Rules block 의 Rules 측).
  categoryEnabled: { essential: true, services: false, notices: false },
  noticeTabEnabled: {},
  pickerSelections: {},
  subscribedTopics: [],
  derivedAt: null,
  // onboardedAt: 시드 시점에 serverTimestamp(). 미온보딩 default doc은 null.
  // Rules: null → timestamp 한 방향 전환만 허용 (시드 후 immutable).
  onboardedAt: null,
  ...overrides,
});

describe('users/{uid}/preferences/main rules — Phase F (SSOT lockdown)', () => {
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // ── CREATE ──────────────────────────────────────────────────────

  test('owner creates preferences with empty subscribedTopics → allow', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(prefsRef(ctx, 'uid-1').set(intentDoc()));
  });

  test('owner creates preferences without subscribedTopics field → allow (intent-only seed)', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    const { subscribedTopics: _drop, ...intentOnly } = intentDoc();
    void _drop;
    await assertSucceeds(prefsRef(ctx, 'uid-1').set(intentOnly));
  });

  test('owner creates preferences with non-empty subscribedTopics → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').set(intentDoc({ subscribedTopics: ['category:academic'] })),
    );
  });

  test('non-owner creates preferences under another uid → deny', async () => {
    const ctx = testEnv.authenticatedContext('attacker');
    await assertFails(prefsRef(ctx, 'victim').set(intentDoc()));
  });

  // ── UPDATE: intent fields ───────────────────────────────────────

  test('owner updates categoryEnabled.notices → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      prefsRef(ctx, 'uid-1').update({ 'categoryEnabled.notices': true }),
    );
  });

  test('owner updates noticeTabEnabled.academic → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      prefsRef(ctx, 'uid-1').update({ 'noticeTabEnabled.academic': false }),
    );
  });

  test('owner updates pickerSelections.dept → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      prefsRef(ctx, 'uid-1').update({ 'pickerSelections.dept': ['cs', 'math'] }),
    );
  });

  // ── UPDATE: derived fields → DENY (the SSOT invariant) ─────────

  test('owner tries to update subscribedTopics directly → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').update({ subscribedTopics: ['evil:topic'] }),
    );
  });

  test('owner tries to update derivedAt directly → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').update({ derivedAt: new Date() }),
    );
  });

  test('owner tries to update intent + subscribedTopics in one call → deny (whole call rejected)', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').update({
        'categoryEnabled.notices': true,
        subscribedTopics: ['piggyback:topic'],
      }),
    );
  });

  // ── READ ─────────────────────────────────────────────────────────

  test('owner reads own preferences → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(prefsRef(ctx, 'uid-1').get());
  });

  test('non-owner reads preferences → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-2');
    await assertFails(prefsRef(ctx, 'uid-1').get());
  });

  // ── DELETE ───────────────────────────────────────────────────────

  test('owner attempts delete → deny (preferences doc is permanent)', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(prefsRef(ctx, 'uid-1').delete());
  });

  // ── ESSENTIAL LOCK — categoryEnabled.essential must always be true ─

  test('owner creates preferences with categoryEnabled.essential = false → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').set(
        intentDoc({
          categoryEnabled: { essential: false, services: false, notices: false },
        }),
      ),
    );
  });

  test('owner updates categoryEnabled.essential = false → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').update({ 'categoryEnabled.essential': false }),
    );
  });

  test('owner updates categoryEnabled.essential = true (idempotent) → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      prefsRef(ctx, 'uid-1').update({ 'categoryEnabled.essential': true }),
    );
  });

  // ── ONBOARDED_AT IMMUTABILITY ────────────────────────────────────
  // 'null → timestamp' 한 방향 전환만 허용 (시드 후 immutable).
  // CF는 admin SDK라 이 룰 우회 가능. 클라가 이미 시드된 timestamp를
  // 다른 timestamp로 바꾸거나 null로 되돌리려 하면 reject.
  // Used as the canonical "user has onboarded" signal for second-device
  // auto-restore (useAppInit prefs listener + notices/index.tsx handler).

  test('owner sets onboardedAt: null → timestamp (seed) → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(intentDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      prefsRef(ctx, 'uid-1').update({ onboardedAt: new Date() }),
    );
  });

  test('owner sets onboardedAt: timestampA → timestampB → deny (immutable)', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(
        intentDoc({ onboardedAt: new Date('2026-01-01') }),
      );
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').update({ onboardedAt: new Date('2026-04-28') }),
    );
  });

  test('owner sets onboardedAt: timestamp → null → deny (immutable)', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(
        intentDoc({ onboardedAt: new Date('2026-01-01') }),
      );
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      prefsRef(ctx, 'uid-1').update({ onboardedAt: null }),
    );
  });

  test('owner updates other field with onboardedAt unchanged → allow (post-onboarding toggle)', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env.firestore().doc('users/uid-1/preferences/main').set(
        intentDoc({
          enabled: true,
          categoryEnabled: { essential: true, services: false, notices: true },
          pickerSelections: { dept: ['cs'] },
          onboardedAt: new Date('2026-01-01'),
        }),
      );
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      prefsRef(ctx, 'uid-1').update({ 'noticeTabEnabled.academic': false }),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// users/{uid}/bookmarks/{key} rules — Phase 1 Chunk A
//
// Subcollection model:
//   users/{uid}/bookmarks/{key}  where  key = `${sourceId}:${articleNo}`
//
// Rules enforce key/value consistency at the path-variable level (only
// possible because each bookmark is its own doc, not a map entry under a
// single doc — Firestore Rules cannot iterate map entries).
//
// The sourceId regex `^[a-z0-9-]+$` is ANCHORED. CEL `matches()` is
// partial-match by default; without the anchors `"valid:bad"` would slip
// through because the substring `valid` matches. The "anchor canary" test
// below is the canary that proves the anchors are doing work.
// ──────────────────────────────────────────────────────────────────────

const bookmarkRef = (ctx, uid, key) =>
  ctx
    .firestore()
    .collection('users')
    .doc(uid)
    .collection('bookmarks')
    .doc(key);

// BookmarkEntry template — every required field per Rules.
const bookmarkEntry = (overrides = {}) => ({
  sourceId: 'cse-undergrad',
  articleNo: 5847,
  savedAt: new Date(),
  title: 'Some notice title',
  department: '컴퓨터공학과',
  date: '2026-04-25',
  sourceUrl: 'https://cse.skku.edu/notice/5847',
  summaryOneLiner: null,
  summaryType: null,
  hasContent: true,
  hasAttachments: false,
  ...overrides,
});

describe('users/{uid}/bookmarks/{key} rules — Phase 1', () => {
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // ── CREATE — happy path ──────────────────────────────────────────

  test('owner creates bookmark with consistent key+entry → allow', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').set(bookmarkEntry()),
    );
  });

  test('owner creates bookmark with multi-source identity (skku-main:136023) → allow', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      bookmarkRef(ctx, 'uid-1', 'skku-main:136023').set(
        bookmarkEntry({ sourceId: 'skku-main', articleNo: 136023 }),
      ),
    );
  });

  // ── CREATE — key/value consistency ───────────────────────────────

  test('owner creates with key disagreeing on sourceId → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'wrong-source:5847').set(
        bookmarkEntry({ sourceId: 'cse-undergrad', articleNo: 5847 }),
      ),
    );
  });

  test('owner creates with key disagreeing on articleNo → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:9999').set(
        bookmarkEntry({ sourceId: 'cse-undergrad', articleNo: 5847 }),
      ),
    );
  });

  // ── CREATE — sourceId regex enforcement ──────────────────────────

  test('owner creates with uppercase sourceId → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'CSE:5847').set(
        bookmarkEntry({ sourceId: 'CSE', articleNo: 5847 }),
      ),
    );
  });

  // ⭐ ANCHOR CANARY — without `^...$` anchors on the matches() regex,
  //    "valid:bad" would PASS because the substring "valid" matches
  //    [a-z0-9-]+. This test proves the anchor is doing work. If this
  //    test passes when anchors are removed, the anchor regression
  //    has slipped through.
  test('owner creates with sourceId "valid:bad" (anchor canary) → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'valid:bad:5847').set(
        bookmarkEntry({ sourceId: 'valid:bad', articleNo: 5847 }),
      ),
    );
  });

  test('owner creates with sourceId "abc/../etc" (path-traversal canary) → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    // Note: Firestore document IDs reject `/`, so we can't actually create
    // such a key — but the *value* validation happens before any path
    // resolution, so we exercise the regex by setting the field directly.
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'abc:5847').set(
        bookmarkEntry({ sourceId: 'abc/../etc', articleNo: 5847 }),
      ),
    );
  });

  // ── CREATE — articleNo validation ────────────────────────────────

  test('owner creates with negative articleNo → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:-5').set(
        bookmarkEntry({ articleNo: -5 }),
      ),
    );
  });

  test('owner creates with zero articleNo → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:0').set(
        bookmarkEntry({ articleNo: 0 }),
      ),
    );
  });

  test('owner creates with string articleNo → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').set(
        bookmarkEntry({ articleNo: '5847' }),
      ),
    );
  });

  // ── CROSS-USER + UNAUTH ──────────────────────────────────────────

  test('user A tries to create bookmark in user B path → deny', async () => {
    const attackerCtx = testEnv.authenticatedContext('attacker-uid');
    await assertFails(
      bookmarkRef(attackerCtx, 'victim-uid', 'cse-undergrad:5847').set(bookmarkEntry()),
    );
  });

  test('user A tries to read user B bookmark → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/victim-uid/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const attackerCtx = testEnv.authenticatedContext('attacker-uid');
    await assertFails(
      bookmarkRef(attackerCtx, 'victim-uid', 'cse-undergrad:5847').get(),
    );
  });

  test('unauthenticated user tries to write → deny', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').set(bookmarkEntry()),
    );
  });

  test('unauthenticated user tries to read → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').get());
  });

  // ── READ + DELETE — owner OK ─────────────────────────────────────

  test('owner reads own bookmark → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').get());
  });

  test('owner deletes own bookmark → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').delete());
  });

  test('user A tries to delete user B bookmark → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/victim-uid/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const attackerCtx = testEnv.authenticatedContext('attacker-uid');
    await assertFails(
      bookmarkRef(attackerCtx, 'victim-uid', 'cse-undergrad:5847').delete(),
    );
  });

  // ── UPDATE — same constraints as CREATE ──────────────────────────

  test('owner updates own bookmark with consistent key+entry → allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').set(
        bookmarkEntry({ title: 'Updated title' }),
      ),
    );
  });

  test('owner updates own bookmark trying to mutate sourceId mismatch → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').set(
        bookmarkEntry({ sourceId: 'different-source' }),
      ),
    );
  });

  // ── UPDATE — partial update (opportunistic summary refresh path) ─
  //
  // Locks the assumption used by `updateBookmarkSummary()` in
  // services/firestore-bookmarks.ts: a partial `update({summaryOneLiner,
  // summaryType})` is allowed because `request.resource.data` evaluates as
  // the post-merge doc — pre-existing identity/savedAt/title fields survive
  // the merge and satisfy the type/identity checks at firestore.rules:81-89.
  //
  // If anyone later tightens Rules with an `affectedKeys()` whitelist or
  // reshapes the validation, the first test will fail loudly instead of
  // silently breaking the detail-screen refresh path.

  test('owner partial-updates summaryOneLiner via update() → allow (savedAt preserved by merge)', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry({ summaryOneLiner: null, summaryType: null }));
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').update({
        summaryOneLiner: 'Filled by detail-open refresh',
        summaryType: 'informational',
      }),
    );
  });

  test('owner update() trying to tamper sourceId identity → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (env) => {
      await env
        .firestore()
        .doc('users/uid-1/bookmarks/cse-undergrad:5847')
        .set(bookmarkEntry());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      bookmarkRef(ctx, 'uid-1', 'cse-undergrad:5847').update({
        sourceId: 'other-source',
      }),
    );
  });
});

describe('account_deletion_feedback/{docId} rules — lockdown', () => {
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // Anonymous, intentionally — the user is leaving the app. Writes happen
  // exclusively from the `deleteAccount` Cloud Function via Admin SDK
  // (which bypasses rules). Nothing client-side should ever touch this
  // collection.

  test('authed Google user tries to create feedback doc → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      ctx
        .firestore()
        .collection('account_deletion_feedback')
        .add({ reasons: ['not_used'], createdAt: new Date() }),
    );
  });

  test('authed user tries to read feedback collection → deny', async () => {
    // Seed a doc via admin (rules-bypassing) context so there is something
    // present to attempt to read.
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin
        .firestore()
        .collection('account_deletion_feedback')
        .doc('seed')
        .set({ reasons: ['bugs'], createdAt: new Date() });
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      ctx.firestore().collection('account_deletion_feedback').doc('seed').get(),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// users/{uid}/feedback/{docId} rules — review-prompt stage 2b
// ──────────────────────────────────────────────────────────────────────

describe('users/{uid}/feedback/{docId} rules', () => {
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const feedbackDoc = (overrides = {}) => ({
    context: 'ai_summary_helpful_sheet',
    text: 'AI summary missed the deadline',
    // serverTimestamp() so the rule check `createdAt == request.time`
    // passes — emulator resolves the sentinel to its own clock at write.
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...overrides,
  });

  const feedbackCol = (ctx, uid) =>
    ctx.firestore().collection('users').doc(uid).collection('feedback');

  test('owner creates feedback with valid context+text+createdAt → allow', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(feedbackCol(ctx, 'uid-1').add(feedbackDoc()));
  });

  test('owner reads their own feedback → allow', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    const ref = await feedbackCol(ctx, 'uid-1').add(feedbackDoc());
    await assertSucceeds(ref.get());
  });

  test('non-owner creates under another uid → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-2');
    await assertFails(feedbackCol(ctx, 'uid-1').add(feedbackDoc()));
  });

  test('unknown context value → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      feedbackCol(ctx, 'uid-1').add(
        feedbackDoc({ context: 'random_other_context' }),
      ),
    );
  });

  test('text > 2000 chars → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      feedbackCol(ctx, 'uid-1').add(feedbackDoc({ text: 'a'.repeat(2001) })),
    );
  });

  test('client supplies non-server createdAt (backdate) → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      feedbackCol(ctx, 'uid-1').add(
        feedbackDoc({ createdAt: new Date('2020-01-01T00:00:00Z') }),
      ),
    );
  });

  test('unauthenticated client tries to create feedback → deny', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(feedbackCol(ctx, 'uid-1').add(feedbackDoc()));
  });

  test('valid noticeRef (sourceId + articleNo) → allow', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertSucceeds(
      feedbackCol(ctx, 'uid-1').add(
        feedbackDoc({ sourceId: 'portal-notice', articleNo: 12345 }),
      ),
    );
  });

  test('uppercase sourceId (anchor canary) → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      feedbackCol(ctx, 'uid-1').add(
        feedbackDoc({ sourceId: 'Portal-Notice', articleNo: 1 }),
      ),
    );
  });

  test('negative articleNo → deny', async () => {
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      feedbackCol(ctx, 'uid-1').add(
        feedbackDoc({ sourceId: 'portal', articleNo: -1 }),
      ),
    );
  });

  test('owner tries to update existing feedback → deny (append-only)', async () => {
    // Seed via admin so we have a doc to attempt to mutate.
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin
        .firestore()
        .collection('users')
        .doc('uid-1')
        .collection('feedback')
        .doc('seed')
        .set(feedbackDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(
      feedbackCol(ctx, 'uid-1').doc('seed').update({ text: 'tampered' }),
    );
  });

  test('owner tries to delete existing feedback → deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await admin
        .firestore()
        .collection('users')
        .doc('uid-1')
        .collection('feedback')
        .doc('seed')
        .set(feedbackDoc());
    });
    const ctx = testEnv.authenticatedContext('uid-1');
    await assertFails(feedbackCol(ctx, 'uid-1').doc('seed').delete());
  });
});
