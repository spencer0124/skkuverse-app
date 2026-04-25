import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/logger';
import type { PreferencesDocument } from './types';

const REGION = 'asia-northeast3';

/**
 * Firestore onWrite trigger: users/{uid}/preferences/main
 *
 * When a user's preferences change (enabled / subscribedTopics), fan out
 * the change to every active device doc owned by that uid. Mirrors the two
 * replica fields only — NEVER touches token/locale/appVersion/lastActive/
 * platform/uid/active to avoid clobbering per-device values (another
 * device's FCM token, etc.).
 *
 * Triggers:
 *   - create: initial preferences bootstrap write from useAppInit
 *     → before/after guard below usually short-circuits (bootstrap re-writes
 *       same values; devices typically not yet indexed)
 *   - update: user toggles in NotificationSettingsScreen
 *   - delete: skip (app never deletes; server state ambiguous)
 *
 * Retry: enabled. 2nd gen default is OFF; we explicitly turn on so transient
 * failures (cold-start timeout, Firestore throttle, batch commit retryable
 * errors) self-recover. Whitelist update is idempotent so replaying is safe.
 * Event age guard caps retries to avoid 7-day stale replication storms.
 */
export const syncPreferencesToDevices = onDocumentWritten(
  {
    document: 'users/{uid}/preferences/main',
    region: REGION,
    retry: true,
    maxInstances: 10,
  },
  async (event) => {
    const uid = event.params.uid;

    // ── Event age guard — drop ancient retries
    // retry: true + 2nd gen = retries span up to ~7 days. For a field-level
    // mirror, a retry that lands 6 days later replicates a preferences value
    // that has since been superseded. Cap at 10 minutes.
    // event.time is RFC3339 per firebase-functions/v2/core CloudEvent spec.
    const eventAgeMs = Date.now() - Date.parse(event.time);
    if (eventAgeMs > 10 * 60 * 1000) {
      logger.warn('event too old, dropping', { uid, eventAgeMs });
      return;
    }

    // ── Narrow event.data once for clean access below
    const change = event.data;
    if (!change?.after.exists) {
      logger.info('preferences doc deleted or missing; skip', { uid });
      return;
    }
    const afterData = change.after.data() as PreferencesDocument;
    const beforeData = change.before.exists
      ? (change.before.data() as PreferencesDocument)
      : undefined;

    // ── Replica-field diff guard — short-circuit no-op
    // Without this, useAppInit's bootstrap (every app launch) fires this
    // function even when preferences didn't actually change. Cost multiplier
    // = MAU × devices per user. Blaze absorbs it fine but the clean path is
    // to skip when before == after on the two replicated fields.
    // Use Set comparison — topics are semantically a set, not an ordered list.
    if (beforeData) {
      const sameEnabled = beforeData.enabled === afterData.enabled;
      const beforeSet = new Set(beforeData.subscribedTopics);
      const afterSet = new Set(afterData.subscribedTopics);
      const sameTopics =
        beforeSet.size === afterSet.size &&
        [...beforeSet].every((t) => afterSet.has(t));
      if (sameEnabled && sameTopics) {
        logger.debug('replica fields unchanged; skip', { uid });
        return;
      }
    }

    const db = getFirestore();
    const devicesSnap = await db
      .collection('devices')
      .where('uid', '==', uid)
      .where('active', '==', true)
      .get();

    if (devicesSnap.empty) {
      logger.info('no active devices for uid; nothing to sync', { uid });
      return;
    }

    // Batch write — up to 500 ops per batch. Real-world uids have < 10
    // devices so a single batch fits easily; loop guards the edge.
    //
    // Field/value overload of batch.update: explicitly names the two
    // replica fields at the call site, reinforcing the whitelist intent
    // (never touch token / locale / appVersion / lastActive / platform /
    // uid / active — those are per-device, not derived from preferences).
    const BATCH_LIMIT = 500;
    for (let i = 0; i < devicesSnap.docs.length; i += BATCH_LIMIT) {
      const chunk = devicesSnap.docs.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.update(
          doc.ref,
          'subscribedTopics', afterData.subscribedTopics,
          'notificationsEnabled', afterData.enabled,
        );
      }
      await batch.commit();
    }

    logger.info('synced preferences to devices', {
      uid,
      deviceCount: devicesSnap.size,
      enabled: afterData.enabled,
      topicCount: afterData.subscribedTopics.length,
    });
  },
);
