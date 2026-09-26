/**
 * Integration verifier for `onUserProfileWrite`.
 *
 * Boots with the Firestore + Functions emulators (scripts/verify-trigger.sh
 * runs it after verify-trigger.ts) and asserts that:
 *   1. A nickname change rewrites the player's entries on every board.
 *   2. The campus follows the same way.
 *   3. Another player's entry is never touched.
 *   4. A write that leaves the projection alone (updatedAt only) rewrites
 *      nothing — checked by planting a stale value that must stay stale.
 *
 * Run: `npm run verify:trigger` from functions/.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= 'demo-skku-verify-trigger';

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = getFirestore();

const UID = `verify-profile-${Date.now()}`;
const TRIGGER_LATENCY_MS = 4000;
const user = db.doc(`users/${UID}`);
const mine = [db.doc(`leaderboards/wave-run/scores/${UID}`), db.doc(`leaderboards/other-game/scores/${UID}`)];
const theirs = db.doc(`leaderboards/wave-run/scores/${UID}-bystander`);

const profile = (p: Record<string, unknown>) => ({ profile: { updatedAt: new Date(), ...p } });

async function fieldsOf(ref: FirebaseFirestore.DocumentReference) {
  const d = (await ref.get()).data() ?? {};
  return { nickname: d.nickname, campus: d.campus };
}

async function main(): Promise<void> {
  console.log(`\n=== verify-profile-trigger.ts (uid=${UID}) ===\n`);

  await user.set(profile({ campus: 'hssc', nickname: 'before' }));
  await sleep(TRIGGER_LATENCY_MS);
  for (const ref of mine) await ref.set({ uid: UID, score: 10, nickname: 'before', campus: 'hssc' });
  await theirs.set({ uid: 'bystander', score: 20, nickname: 'someone', campus: 'nsc' });

  console.log('Scenario 1+2: nickname and campus change');
  await user.set(profile({ campus: 'nsc', nickname: 'after' }));
  await sleep(TRIGGER_LATENCY_MS);
  for (const ref of mine) {
    assert.deepEqual(await fieldsOf(ref), { nickname: 'after', campus: 'nsc' }, ref.path);
  }
  console.log('  ✓ both boards follow');

  console.log('Scenario 3: bystander untouched');
  assert.deepEqual(await fieldsOf(theirs), { nickname: 'someone', campus: 'nsc' });
  console.log('  ✓');

  console.log('Scenario 4: updatedAt-only write rewrites nothing');
  await mine[0]!.update({ nickname: 'stale' });
  await user.set(profile({ campus: 'nsc', nickname: 'after' }));
  await sleep(TRIGGER_LATENCY_MS);
  assert.equal((await fieldsOf(mine[0]!)).nickname, 'stale');
  console.log('  ✓');

  console.log('\n✅ All 4 scenarios passed\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([user, ...mine, theirs].map((r) => r.delete().catch(() => undefined)));
  });
