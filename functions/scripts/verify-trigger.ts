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
 *   5. dept[0] === '' sentinel ("대표학과 스킵") → derive filters falsy
 *      ids; truthy interest ids still emit, no invalid 'dept:' topic.
 *   6. miniAppSelections → miniapp:<id> 토픽. Guard 1이 이 필드를 보는지까지
 *      함께 검증한다 — 이 필드만 바뀐 write는 다른 네 필드를 건드리지 않으므로,
 *      Guard 1에서 빠뜨리면 derive 자체가 아예 안 돌고 조용히 미구독으로 남는다.
 *
 * Run: `npm run verify:trigger` from functions/ (boots emulator + this script).
 *
 * Why this lives in the repo (vs throwaway script):
 *   Every future change to derive.ts / equality.ts / onPreferencesWrite.ts
 *   gets push-button regression coverage. unit tests cover the pure logic;
 *   this covers trigger fire + Firestore round-trip + guard interactions.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
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
    noticeTabEnabled: {},
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

  // ── Scenario 5: dept[0] === '' sentinel → derive filters falsy ids ──
  // 사용자가 wizard step 2 "내 학과가 없어요" 경로로 primary를 건너뛰고
  // interest 2개만 picking. storage엔 sentinel '' 유지하지만 derive는
  // emit 단계에서 falsy id 필터링 → 'dept:' invalid topic 누수 없음.
  console.log('\nScenario 5: dept[0]="" sentinel → only truthy ids become topics');
  await ref.set({
    enabled: true,
    categoryEnabled: { essential: false, services: false, notices: true },
    noticeTabEnabled: {},
    pickerSelections: { dept: ['', '12345', '67890'] },
    subscribedTopics: [],
    derivedAt: null,
  });
  await sleep(TRIGGER_LATENCY_MS);

  const s5 = await readState();
  // 5 fixed + 2 valid dept (sentinel '' filtered) = 7
  assert.equal(
    s5.subscribedTopics.length,
    7,
    `expected 7 topics (5 fixed + 2 valid dept), got ${s5.subscribedTopics.length}: ${JSON.stringify(s5.subscribedTopics)}`,
  );
  assert.ok(
    !s5.subscribedTopics.includes('dept:'),
    "invalid 'dept:' topic must not be emitted from sentinel '' id",
  );
  assert.ok(s5.subscribedTopics.includes('dept:12345'), 'dept:12345 should be present');
  assert.ok(s5.subscribedTopics.includes('dept:67890'), 'dept:67890 should be present');
  console.log(`  ✓ 7 topics derived, sentinel '' filtered: ${JSON.stringify(s5.subscribedTopics.sort())}`);

  // ── Scenario 6 ────────────────────────────────────────────────────
  //
  // 이 시나리오의 진짜 대상은 derive가 아니라 **Guard 1**이다. derive의 매핑은
  // 단위 테스트가 이미 덮고 있고, 여기서만 잡히는 건 "miniAppSelections만 바뀐
  // write가 트리거를 실제로 통과하는가"다. Guard 1에서 이 필드를 빠뜨리면
  // intentChanged=false로 조기 return → 구독은 기록됐는데 토픽은 영영 안 생기는,
  // 에러 없이 조용한 실패가 된다.
  console.log('\nScenario 6: mini-app subscription → miniapp:<id> (Guard 1 sees the field)');
  await ref.set({
    enabled: true,
    categoryEnabled: { essential: false, services: false, notices: true },
    noticeTabEnabled: {},
    pickerSelections: {},
    subscribedTopics: [],
    derivedAt: null,
  });
  await sleep(TRIGGER_LATENCY_MS);
  const s6Before = await readState();

  // 앱이 실제로 쓰는 그대로: 이 한 필드만 건드리는 dot-path arrayUnion.
  await ref.update({ miniAppSelections: FieldValue.arrayUnion('eskara-2026') });
  await sleep(TRIGGER_LATENCY_MS);

  const s6 = await readState();
  assert.ok(
    s6.subscribedTopics.includes('miniapp:eskara-2026'),
    `miniAppSelections-only write must re-derive (Guard 1). before=${JSON.stringify(s6Before.subscribedTopics.sort())} after=${JSON.stringify(s6.subscribedTopics.sort())}`,
  );
  console.log('  ✓ miniapp:eskara-2026 derived from a single-field write');

  // 해제도 같은 경로 — arrayRemove 한 필드만.
  await ref.update({ miniAppSelections: FieldValue.arrayRemove('eskara-2026') });
  await sleep(TRIGGER_LATENCY_MS);

  const s6After = await readState();
  assert.ok(
    !s6After.subscribedTopics.some((t) => t.startsWith('miniapp:')),
    `unsubscribe must remove the topic, got ${JSON.stringify(s6After.subscribedTopics.sort())}`,
  );
  // 공지 토픽은 그대로여야 한다 — 미니앱 토글이 공지 구독을 건드리면 안 된다.
  assert.equal(
    s6After.subscribedTopics.length,
    s6Before.subscribedTopics.length,
    'notice topics must be untouched by a mini-app toggle',
  );
  console.log('  ✓ unsubscribed, notice topics untouched');

  console.log('\n✅ All 6 scenarios passed\n');
}

main()
  .then(cleanup)
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\n❌ verify-trigger failed:', err);
    await cleanup();
    process.exit(1);
  });
