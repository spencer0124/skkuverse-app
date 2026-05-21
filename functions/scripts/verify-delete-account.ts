/**
 * Integration verifier for `deleteAccount` callable CF.
 *
 * Boots Firestore + Auth + Functions emulators via `firebase emulators:exec`,
 * then exercises three scenarios end-to-end:
 *
 *   1. Happy path with feedback → all data wiped, auth user gone, anonymous
 *      feedback doc recorded (without uid).
 *   2. Happy path without feedback → identical cleanup, no feedback doc.
 *   3. Idempotent re-call → second invocation returns ok (auth/user-not-found
 *      treated as success server-side).
 *
 * Auth path: createUser → createCustomToken → exchange via Auth emulator's
 * Identity Toolkit REST endpoint for an ID token → POST callable with
 * Authorization Bearer.
 *
 * Run: `npm run verify:delete-account` from functions/ (boots emulator +
 * this script).
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import assert from 'node:assert/strict';

// ── Emulator wiring ────────────────────────────────────────────────────

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FUNCTIONS_EMULATOR_HOST ??= '127.0.0.1:5001';
process.env.GCLOUD_PROJECT ??= 'demo-skku-delete-account';

const PROJECT = process.env.GCLOUD_PROJECT;
const REGION = 'asia-northeast3';
const CALLABLE_URL = `http://${process.env.FUNCTIONS_EMULATOR_HOST}/${PROJECT}/${REGION}/deleteAccount`;

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();
const adminAuth = getAdminAuth();

// ── Helpers ────────────────────────────────────────────────────────────

async function mintIdToken(uid: string, email: string): Promise<string> {
  // Note: `firebase` is a reserved claim on createCustomToken — cannot be
  // set. The Auth emulator stamps `firebase.sign_in_provider = 'custom'`
  // automatically, which is fine for our verifier: the CF only rejects when
  // sign_in_provider === 'anonymous'. Truly-anonymous coverage lives in
  // production manual E2E (UI hides the button for anon, so CF guard is a
  // defensive backstop).
  const customToken = await adminAuth.createCustomToken(uid, { email });
  const res = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `mintIdToken failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { idToken: string };
  return json.idToken;
}

type CallableResponse = {
  status: number;
  body: { result?: { ok: true }; error?: { message: string; status: string } };
};

async function callDelete(
  idToken: string | null,
  payload: unknown,
): Promise<CallableResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // App Check is `enforceAppCheck: true` on the CF. The Functions emulator
    // does not validate this token; any non-empty value bypasses the MISSING
    // gate. Production clients attach a real attested token via
    // `@react-native-firebase/functions`.
    'X-Firebase-AppCheck': 'emulator-fake',
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(CALLABLE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: payload }),
  });
  const body = (await res.json()) as CallableResponse['body'];
  return { status: res.status, body };
}

async function seedUser(uid: string): Promise<void> {
  await db.doc(`users/${uid}`).set({ locale: 'ko' });
  await db.doc(`users/${uid}/preferences/main`).set({
    enabled: true,
    categoryEnabled: { essential: true, services: true, notices: true },
    noticeTabEnabled: { academic: true },
    pickerSelections: { dept: ['12345'] },
    subscribedTopics: ['notices_essential_skku-main'],
    derivedAt: new Date(),
  });
  await db.doc(`users/${uid}/bookmarks/cse-undergrad:5847`).set({
    sourceId: 'cse-undergrad',
    articleNo: 5847,
    title: 'Test notice',
    savedAt: new Date(),
  });
  await db.doc(`users/${uid}/bookmarks/skku-main:12345`).set({
    sourceId: 'skku-main',
    articleNo: 12345,
    title: 'Another notice',
    savedAt: new Date(),
  });
  await db.doc('devices/dev-1').set({
    uid,
    deviceId: 'dev-1',
    active: true,
    token: 'fake-fcm-token-1',
    subscribedTopics: ['notices_essential_skku-main'],
    notificationsEnabled: true,
    platform: 'ios',
    lastActive: new Date(),
  });
  await db.doc('devices/dev-2').set({
    uid,
    deviceId: 'dev-2',
    active: true,
    token: 'fake-fcm-token-2',
    subscribedTopics: ['notices_essential_skku-main'],
    notificationsEnabled: true,
    platform: 'android',
    lastActive: new Date(),
  });
}

async function assertCleaned(uid: string): Promise<void> {
  // users + subcollections gone.
  const userDoc = await db.doc(`users/${uid}`).get();
  assert.equal(userDoc.exists, false, 'users/{uid} should be deleted');
  const prefDoc = await db.doc(`users/${uid}/preferences/main`).get();
  assert.equal(prefDoc.exists, false, 'preferences/main should be deleted');
  const bookmarks = await db.collection(`users/${uid}/bookmarks`).get();
  assert.equal(bookmarks.size, 0, 'bookmarks should be empty');

  // devices deactivated, token + topics wiped.
  const devices = await db
    .collection('devices')
    .where('uid', '==', uid)
    .get();
  for (const doc of devices.docs) {
    const data = doc.data();
    assert.equal(data.active, false, `${doc.id}.active should be false`);
    assert.equal(data.token, '', `${doc.id}.token should be wiped`);
    assert.deepEqual(
      data.subscribedTopics,
      [],
      `${doc.id}.subscribedTopics should be empty`,
    );
    assert.equal(
      data.notificationsEnabled,
      false,
      `${doc.id}.notificationsEnabled should be false`,
    );
  }

  // Auth user gone. FirebaseAuthError thrown by getUser carries the code
  // on the `.code` field, not in the message — match against that.
  await assert.rejects(
    adminAuth.getUser(uid),
    (err: unknown) => {
      const code = (err as { code?: string })?.code;
      assert.equal(
        code,
        'auth/user-not-found',
        `expected auth/user-not-found, got ${code}`,
      );
      return true;
    },
    'auth user should be deleted',
  );
}

async function clearAll(): Promise<void> {
  // Wipe Firestore via emulator REST endpoint (clean slate per scenario).
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  // Wipe Auth.
  await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`,
    { method: 'DELETE' },
  );
}

// ── Scenarios ──────────────────────────────────────────────────────────

async function scenario1WithFeedback(): Promise<void> {
  console.log('\n[1] happy path with feedback');
  await clearAll();
  const uid = 'uid-with-feedback';
  await adminAuth.createUser({ uid, email: 'test1@g.skku.edu' });
  await seedUser(uid);

  const idToken = await mintIdToken(uid, 'test1@g.skku.edu');
  const res = await callDelete(idToken, {
    feedback: { reasons: ['bugs', 'too_many_notifs'], otherText: '  detail  ' },
  });
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.deepEqual(res.body.result, { ok: true });

  await assertCleaned(uid);

  const feedback = await db.collection('account_deletion_feedback').get();
  assert.equal(feedback.size, 1, 'feedback doc should be recorded');
  const fbData = feedback.docs[0].data();
  assert.deepEqual(
    [...fbData.reasons].sort(),
    ['bugs', 'too_many_notifs'].sort(),
    'reasons stored verbatim (order-insensitive)',
  );
  assert.equal(fbData.otherText, 'detail', 'otherText trimmed');
  assert.equal('uid' in fbData, false, 'uid must NOT be stored (anonymity)');
  assert.ok(fbData.createdAt, 'createdAt set by serverTimestamp');
  console.log('   ✓ cleaned + feedback recorded anonymously');
}

async function scenario2NoFeedback(): Promise<void> {
  console.log('\n[2] happy path without feedback');
  await clearAll();
  const uid = 'uid-no-feedback';
  await adminAuth.createUser({ uid, email: 'test2@g.skku.edu' });
  await seedUser(uid);

  const idToken = await mintIdToken(uid, 'test2@g.skku.edu');
  const res = await callDelete(idToken, {});
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.deepEqual(res.body.result, { ok: true });

  await assertCleaned(uid);

  const feedback = await db.collection('account_deletion_feedback').get();
  assert.equal(
    feedback.size,
    0,
    'no feedback doc should be created when caller omits feedback',
  );
  console.log('   ✓ cleaned, no feedback doc created');
}

async function scenario3Idempotent(): Promise<void> {
  console.log('\n[3] idempotent re-call (second call after deletion)');
  await clearAll();
  const uid = 'uid-idempotent';
  await adminAuth.createUser({ uid, email: 'test3@g.skku.edu' });
  await seedUser(uid);

  const idToken = await mintIdToken(uid, 'test3@g.skku.edu');
  const first = await callDelete(idToken, {});
  assert.equal(first.status, 200);

  // Re-call with the same token (still valid for ~1h in emulator). The auth
  // user is gone server-side, but the token verifies; CF should swallow
  // user-not-found and return ok.
  const second = await callDelete(idToken, {});
  assert.equal(
    second.status,
    200,
    `idempotent re-call should return 200, got ${second.status}: ${JSON.stringify(second.body)}`,
  );
  assert.deepEqual(second.body.result, { ok: true });
  console.log('   ✓ second call returns ok (auth/user-not-found swallowed)');
}

async function scenario4Unauthenticated(): Promise<void> {
  console.log('\n[4] unauthenticated call rejects');
  await clearAll();
  const res = await callDelete(null, {});
  // Callable protocol returns 401 with error object for unauthenticated.
  assert.notEqual(res.status, 200, 'should not return 200 without auth');
  assert.ok(res.body.error, 'should return callable error envelope');
  assert.equal(
    res.body.error?.status,
    'UNAUTHENTICATED',
    `expected UNAUTHENTICATED, got ${res.body.error?.status}`,
  );
  console.log('   ✓ rejected with UNAUTHENTICATED');
}

async function main(): Promise<void> {
  console.log(`=== verify-delete-account.ts (project=${PROJECT}) ===`);
  console.log(`callable url: ${CALLABLE_URL}`);

  await scenario1WithFeedback();
  await scenario2NoFeedback();
  await scenario3Idempotent();
  await scenario4Unauthenticated();

  console.log('\n✅ all scenarios passed');
}

main().catch((err) => {
  console.error('\n❌ verify-delete-account failed:', err);
  process.exit(1);
});
