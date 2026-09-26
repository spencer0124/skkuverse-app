/**
 * One-off audit + repair for the "ghost preferences" population.
 *
 * A user whose `users/{uid}/preferences/main` document is MISSING has a
 * permanently dead write path: every client writer uses `update()`, a patch
 * mutation, which cannot create the document. The department picker therefore
 * does nothing forever, and the notices tab renders the rung-3 fallback —
 * 건축학과. This is the 2026-07 incident (postmortem:
 * docs/internal/2026-07-notices-picker-ghost-state.md) and its 2026-09
 * recurrence.
 *
 * The 2026-07 fix relied solely on a client-side self-heal, which requires the
 * user to (1) receive the OTA, (2) relaunch, AND (3) have onAuthStateChanged
 * fire non-anonymously — and (3) is exactly what Android's linkWithCredential
 * breaks, because it preserves the uid and never fires that callback. A user
 * who stopped opening the app never recovers at all. This script has none of
 * those dependencies and is idempotent.
 *
 * ── What this DOES and DOES NOT do ───────────────────────────────────────
 *
 * It unblocks the write path. It does NOT restore the user's department
 * selection: the only copy of that lives in the device's MMKV. A healed
 * document carries `pickerSelections: {}`, so the user still sees 건축학과
 * until they re-pick — but the re-pick will now SAVE, which is the point.
 *
 * Its other purpose is measurement. The 2026-07 incident ran 84 days undetected
 * because nobody had a number for how many users were affected. `--dry-run`
 * produces that number.
 *
 * ── Why it is driven from Auth, not Firestore ────────────────────────────
 *
 * A collectionGroup scan over `preferences/main` can only enumerate documents
 * that EXIST, and this population is defined by absence. Auth is the only
 * complete roster of users, so we page it and probe.
 *
 * ── Payload constraint that is load-bearing ──────────────────────────────
 *
 * `onboardedAt` MUST be null. It is the auto-restore discriminator read by
 * useAppInit's onPreferencesChanged listener; a fabricated timestamp would make
 * `restoreOnboardingFromRemote` overwrite the user's real MMKV department with
 * an empty list — the backfill would CAUSE the bug it is repairing.
 * `essential: true` is equally load-bearing: the rules ESSENTIAL LOCK rejects
 * any later client update on a document that lacks it (the 2026-07 root cause).
 *
 * Run:
 *   node --experimental-strip-types scripts/backfill-prefs.ts --dry-run
 *   node --experimental-strip-types scripts/backfill-prefs.ts --apply
 */

import {
  getApps,
  initializeApp,
  applicationDefault,
  cert,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ── Safety rails ─────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

// Sibling scripts in this directory (verify-trigger, verify-delete-account)
// hard-pin the emulator hosts. Inheriting one here would silently "repair" an
// empty emulator and report a reassuring zero, so refuse outright rather than
// produce a meaningless number.
for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (process.env[v]) {
    throw new Error(
      `${v} is set (${process.env[v]}). This script targets PRODUCTION; ` +
        `unset it, or you will audit an empty emulator and learn nothing.`,
    );
  }
}

const PROJECT = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT;
if (!PROJECT) {
  throw new Error(
    'Set GCLOUD_PROJECT to the production project id, and authenticate with ' +
      'FIREBASE_SERVICE_ACCOUNT (inline JSON), GOOGLE_APPLICATION_CREDENTIALS, ' +
      'or `gcloud auth application-default login`.',
  );
}

// Credential resolution, in order of preference:
//   1. FIREBASE_SERVICE_ACCOUNT — inline JSON, the same variable and shape
//      skkuverse-server already uses (src/infra/firebase.ts). Preferred here
//      because it means no gcloud SDK install and no key file written to disk.
//   2. GOOGLE_APPLICATION_CREDENTIALS / ADC — the standard path, for CI or a
//      machine that has already run `gcloud auth application-default login`.
//
// The inline JSON is read from the environment and never logged or persisted.
function resolveCredential() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inline) as Record<string, unknown>;
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON. Pass the whole ' +
          'service-account object, not a file path.',
      );
    }
    // Fail loudly on a credential for the wrong project rather than auditing
    // someone else's user list and reporting a meaningless number.
    if (parsed.project_id && parsed.project_id !== PROJECT) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT is for project '${String(parsed.project_id)}' ` +
          `but GCLOUD_PROJECT is '${PROJECT}'. Refusing to run.`,
      );
    }
    return cert(parsed as Parameters<typeof cert>[0]);
  }
  return applicationDefault();
}

if (getApps().length === 0) {
  initializeApp({ credential: resolveCredential(), projectId: PROJECT });
}
const db = getFirestore();
const auth = getAuth();

// Byte-for-byte mirror of DEFAULT_PREFS in
// apps/mobile/src/services/firestore-notifications.ts. Drift here is silent and
// dangerous — see the two load-bearing fields in the docblock above.
const DEFAULT_PREFS = {
  enabled: false,
  categoryEnabled: { essential: true, services: false, notices: false },
  noticeTabEnabled: {},
  pickerSelections: {},
  subscribedTopics: [],
  derivedAt: null,
  onboardedAt: null,
} as const;

const PROBE_CHUNK = 300; // getAll() fan-out per round trip
const WRITE_DELAY_MS = 50; // each create fires onPreferencesWrite → derive

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(
    `[backfill-prefs] project=${PROJECT} mode=${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`,
  );

  let scanned = 0;
  let googleUsers = 0;
  let ghosts = 0;
  let created = 0;
  let failed = 0;
  const ghostUids: string[] = [];

  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    pageToken = page.pageToken;
    scanned += page.users.length;

    // Anonymous users legitimately have no preferences document — including
    // them would create one per anonymous install, which is a cost change
    // rather than a repair.
    const candidates = page.users.filter((u) =>
      u.providerData.some((p) => p.providerId === 'google.com'),
    );
    googleUsers += candidates.length;

    for (let i = 0; i < candidates.length; i += PROBE_CHUNK) {
      const slice = candidates.slice(i, i + PROBE_CHUNK);
      const refs = slice.map((u) =>
        db.doc(`users/${u.uid}/preferences/main`),
      );
      const snaps = await db.getAll(...refs);

      for (let j = 0; j < snaps.length; j++) {
        if (snaps[j].exists) continue;
        const uid = slice[j].uid;
        ghosts++;
        ghostUids.push(uid);

        if (DRY_RUN) continue;

        try {
          // create(), never set(): a document that appeared in the meantime
          // (the user relaunched and self-healed) must fail benignly rather
          // than clobber their real selection.
          await refs[j].create(DEFAULT_PREFS);
          created++;
        } catch (err: unknown) {
          const code = (err as { code?: number | string })?.code;
          // Firestore Admin SDK throws gRPC code 6 (ALREADY_EXISTS) here.
          if (code === 6 || code === 'already-exists') {
            console.log(`[backfill-prefs] ${uid}: appeared concurrently, skip`);
          } else {
            failed++;
            console.error(
              `[backfill-prefs] ${uid}: FAILED`,
              (err as { message?: string })?.message ?? err,
            );
          }
        }
        await sleep(WRITE_DELAY_MS);
      }
    }
  } while (pageToken);

  console.log('─'.repeat(60));
  console.log(`scanned auth users : ${scanned}`);
  console.log(`google-linked      : ${googleUsers}`);
  console.log(`GHOSTS (no doc)    : ${ghosts}`);
  if (!DRY_RUN) {
    console.log(`created            : ${created}`);
    console.log(`failed             : ${failed}`);
  }
  console.log('─'.repeat(60));
  if (DRY_RUN) {
    console.log('Dry run — nothing written. Re-run with --apply to repair.');
    console.log('This ghost count is the incident impact number.');
  }
  // Impact figure for the postmortem; keep the uid list out of shared logs.
  if (ghostUids.length > 0 && process.env.PRINT_UIDS === '1') {
    console.log('ghost uids:', ghostUids.join(','));
  }
}

main().catch((err) => {
  console.error('[backfill-prefs] fatal', err);
  process.exit(1);
});
