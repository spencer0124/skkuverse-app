/**
 * Integration verifier for `onPreferencesWrite` derive trigger.
 *
 * Boots a fresh Firestore emulator (via `firebase emulators:exec`), seeds
 * a test preferences doc, and asserts that:
 *   1. Initial seed → trigger derives subscribedTopics + sets derivedAt
 *   2. Self-loop guard works → derivedAt does NOT keep updating after
 *      our own subscribedTopics+derivedAt write echoes back through onWrite
 *   3. Intent change → trigger re-derives correctly
 *   4. Idempotent intent shape (different write but same derive output)
 *      → Guard 2 short-circuits the write
 *
 * Run: `npm run verify:trigger` from functions/ (boots emulator + this script).
 *
 * Why this lives in the repo (vs throwaway script):
 *   Every future change to derive.ts / equality.ts / onPreferencesWrite.ts
 *   gets push-button regression coverage. unit tests cover the pure logic;
 *   this covers trigger fire + Firestore round-trip + guard interactions.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

// Connect admin SDK to emulator. emulators:exec sets FIRESTORE_EMULATOR_HOST
// automatically, but we set defaults for direct invocation too.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= 'demo-skku-verify-trigger';

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = getFirestore();

const TEST_UID = `verify-${Date.now()}`;
const ref = db
  .collection('users')
  .doc(TEST_UID)
  .collection('preferences')
  .doc('main');

// Trigger latency under emulator: cold start ~1.5-2s, hot ~150ms.
// Generous wait keeps the script reliable across machines.
const TRIGGER_LATENCY_MS = 4000;

interface PrefsSnapshot {
  subscribedTopics: string[];
  derivedAt: Timestamp | null;
}

async function readState(): Promise<PrefsSnapshot> {
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`prefs doc missing: ${ref.path}`);
  const data = snap.data() ?? {};
  return {
    subscribedTopics: (data.subscribedTopics ?? []) as string[],
    derivedAt: (data.derivedAt ?? null) as Timestamp | null,
  };
}

async function cleanup(): Promise<void> {
  try {
    await ref.delete();
    await db.collection('users').doc(TEST_UID).delete();
  } catch {
    // best-effort
  }
}

async function main(): Promise<void> {
  console.log(`\n=== verify-trigger.ts (uid=${TEST_UID}) ===\n`);

  // ── Scenario 1: Initial seed → derive populates ──────────────────
  console.log('Scenario 1: initial seed → derive populates');
  await ref.set({
    enabled: true,
    categoryEnabled: { essential: false, services: false, notices: true },
    pickerSelections: { dept: ['12345'] },
    subscribedTopics: [],
    derivedAt: null,
  });
  await sleep(TRIGGER_LATENCY_MS);

  const s1 = await readState();
  // 5 fixed (academic / scholarship / career / recruitment / event) + 1 dept = 6
  assert.equal(
    s1.subscribedTopics.length,
    6,
    `expected 6 topics, got ${s1.subscribedTopics.length}: ${JSON.stringify(s1.subscribedTopics)}`,
  );
  assert.ok(s1.subscribedTopics.includes('category:academic'), 'category:academic missing');
  assert.ok(s1.subscribedTopics.includes('category:scholarship'), 'category:scholarship missing');
  assert.ok(s1.subscribedTopics.includes('category:career'), 'category:career missing');
  assert.ok(s1.subscribedTopics.includes('category:recruitment'), 'category:recruitment missing');
  assert.ok(s1.subscribedTopics.includes('category:event'), 'category:event missing');
  assert.ok(s1.subscribedTopics.includes('dept:12345'), 'dept:12345 missing');
  assert.ok(s1.derivedAt instanceof Timestamp, 'derivedAt should be set');
  console.log(`  ✓ 6 topics derived: ${JSON.stringify(s1.subscribedTopics.sort())}`);
  console.log(`  ✓ derivedAt = ${s1.derivedAt!.toDate().toISOString()}`);

  // ── Scenario 2: Self-loop guard ──────────────────────────────────
  // Our trigger wrote subscribedTopics + derivedAt at scenario 1 end.
  // That write itself fires onWrite again; Guard 1 must short-circuit
  // (intent unchanged) so derivedAt does NOT keep updating.
  console.log('\nScenario 2: self-loop guard — derivedAt stable after initial derive');
  const t1 = s1.derivedAt!;
  await sleep(TRIGGER_LATENCY_MS);

  const s2 = await readState();
  assert.ok(
    s2.derivedAt!.isEqual(t1),
    `derivedAt changed (self-loop?) ${t1.toDate().toISOString()} → ${s2.derivedAt?.toDate().toISOString()}`,
  );
  console.log('  ✓ derivedAt unchanged after extra wait — Guard 1 working');

  // ── Scenario 3: Intent change → re-derive ────────────────────────
  console.log('\nScenario 3: intent change (notices=false) → re-derive empty');
  await ref.update({ 'categoryEnabled.notices': false });
  await sleep(TRIGGER_LATENCY_MS);

  const s3 = await readState();
  assert.equal(
    s3.subscribedTopics.length,
    0,
    `expected 0 topics after notices=false, got ${s3.subscribedTopics.length}`,
  );
  assert.ok(!s3.derivedAt!.isEqual(t1), 'derivedAt should advance after intent change');
  console.log('  ✓ subscribedTopics emptied');
  console.log(`  ✓ derivedAt advanced to ${s3.derivedAt!.toDate().toISOString()}`);

  // ── Scenario 4: Guard 2 idempotency ──────────────────────────────
  // Force a write that touches intent (Guard 1 cannot skip) but produces
  // the same derive output as before. enabled: false → enabled: true with
  // notices already false yields derive() = []. After scenario 3 the doc
  // already has [] so Guard 2 must skip the redundant write.
  console.log('\nScenario 4: Guard 2 idempotency — same derive output → write skipped');
  const t3 = s3.derivedAt!;
  await ref.update({ enabled: false });
  await sleep(TRIGGER_LATENCY_MS);
  const interim = await readState();
  // enabled=false: derive() returns []. current is []. Guard 2 skips →
  // derivedAt should NOT advance.
  assert.equal(interim.subscribedTopics.length, 0, 'subscribedTopics should remain []');
  assert.ok(
    interim.derivedAt!.isEqual(t3),
    'derivedAt should not advance when derive output unchanged (Guard 2)',
  );
  console.log('  ✓ enabled=false yields same []: Guard 2 skipped redundant write');

  await ref.update({ enabled: true });
  await sleep(TRIGGER_LATENCY_MS);
  const final = await readState();
  assert.equal(final.subscribedTopics.length, 0, 'subscribedTopics should remain []');
  assert.ok(
    final.derivedAt!.isEqual(t3),
    'derivedAt should not advance — same derive output as scenario 3',
  );
  console.log('  ✓ enabled=true with notices=false: still [], Guard 2 skipped');

  console.log('\n✅ All 4 scenarios passed\n');
}

main()
  .then(cleanup)
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\n❌ verify-trigger failed:', err);
    await cleanup();
    process.exit(1);
  });
