import { timingSafeEqual } from 'crypto';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { handleNoticeNotification } from './handle-notice';
import { handleMiniAppNotification } from './handle-miniapp';
import { handleEventMapRefresh } from './handle-eventmap-refresh';
import type { NotificationRequest } from './types';

const REGION = 'asia-northeast3';
const FCM_API_KEY = defineSecret('FCM_API_KEY');

/**
 * Constant-time API key compare. Length is checked first because
 * timingSafeEqual throws on mismatched length.
 */
function apiKeyOk(
  given: string | string[] | undefined,
  expected: string,
): boolean {
  const raw = Array.isArray(given) ? given[0] : given;
  if (typeof raw !== 'string') return false;
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * HTTP dispatcher for outbound push notifications.
 *
 * Internal dispatcher — invoked only by backend via X-API-Key auth.
 * Browser clients are not expected. If that changes, switch to cors: ['<origin>'].
 *
 * Type branching delegates to per-type handlers (handleNoticeNotification, ...).
 * New types: add a case below + a sibling handler module.
 */
export const sendNotification = onRequest(
  { region: REGION, secrets: [FCM_API_KEY], cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    // .trim() defends against trailing whitespace introduced by common
    // secret-provisioning flows (e.g. `openssl rand -hex 32 | firebase
    // functions:secrets:set --data-file -` stores the value WITH the
    // trailing newline from openssl). timingSafeEqual's length precheck
    // would otherwise reject every valid client call as 401.
    if (!apiKeyOk(req.headers['x-api-key'], FCM_API_KEY.value().trim())) {
      logger.warn('sendNotification: invalid api key');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as NotificationRequest | undefined;
    if (!body || typeof body.type !== 'string') {
      res.status(400).json({ error: 'Missing or invalid type' });
      return;
    }

    try {
      switch (body.type) {
        case 'notice': {
          const result = await handleNoticeNotification(body);
          res.status(result.status).json(result.body);
          return;
        }
        case 'miniapp': {
          const result = await handleMiniAppNotification(body);
          res.status(result.status).json(result.body);
          return;
        }
        case 'eventmap-refresh': {
          const result = await handleEventMapRefresh(body);
          res.status(result.status).json(result.body);
          return;
        }
        default: {
          // `body` narrows to never here now that the switch covers the whole
          // union — which is the compile-time exhaustiveness we want. The arm
          // still has to exist at runtime: `body` is untrusted JSON that was
          // merely ASSERTED to be a NotificationRequest, so an unknown type is
          // reachable in production even though it is unreachable in the types.
          const unknownType = (body as { type?: unknown }).type;
          res.status(400).json({ error: `Unknown type: ${String(unknownType)}` });
          return;
        }
      }
    } catch (e) {
      logger.error('sendNotification failed', { err: String(e) });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);
