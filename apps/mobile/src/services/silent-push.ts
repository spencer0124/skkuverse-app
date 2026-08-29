import {
  EVENTMAP_MANIFEST_KEY,
  MAP_CONFIG_KEY,
  MAP_LAYER_MARKERS_KEY,
} from '@skkuverse/shared';
import { queryClient } from '@/lib/query-client';
import { devLog } from '@/services/dev-log';

/**
 * Data-only pushes: messages that change app state without ever being seen.
 *
 * Shared by the background handler (module scope, no React tree) and the
 * foreground message handler, because the same payload can arrive in either
 * state and must do the same thing in both.
 *
 * `eventmap-refresh` is NOT a routing case — it never produces a tap, so it is
 * deliberately absent from `notification-router.ts`, where its branch would be
 * unreachable by construction. Contract:
 * docs/reference/miniapp-notification-payload.md.
 *
 * How much this actually buys, honestly: in the foreground the queries are
 * mounted, so invalidation refetches at once — that is the "within seconds"
 * case. The marker endpoint's own Cache-Control is 60s, so the ceiling on what
 * this saves is about a minute; the booth window arithmetic needs none of it,
 * since opening and closing times ride in the payload and the device re-derives.
 * Backgrounded-but-alive only marks the queries stale until focusManager
 * refocuses. In quit state the handler runs in a throwaway JS context whose
 * cache is empty, so this is a no-op and the next cold start fetches fresh
 * anyway. iOS also throttles apns-priority 5 and delivers nothing to a
 * force-quit app. The real safety net underneath remains `refreshAfterSec`
 * polling plus ETag/304; this is an accelerator on top of it, not a replacement.
 *
 * Returns true when the message was silent and fully handled here.
 */
export async function handleSilentPush(
  data: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (data?.type !== 'eventmap-refresh') return false;

  devLog('silentPush.eventmapRefresh', {
    miniAppId: typeof data.miniAppId === 'string' ? data.miniAppId : null,
  });

  try {
    await Promise.all([
      // The booth PINS come from /map/markers/event now, so this is the one
      // that actually moves the map. A prefix, not a key: layers share an
      // endpoint and the endpoint is the last segment, so this reaches every
      // marker query without this file having to know any endpoint's spelling.
      queryClient.invalidateQueries({ queryKey: MAP_LAYER_MARKERS_KEY }),
      // Which layers EXIST changes when the activation window opens or closes,
      // and that is a /map/config answer rather than a marker one.
      queryClient.invalidateQueries({ queryKey: MAP_CONFIG_KEY }),
      // Still the manifest and not the snapshot: a new version means a new
      // snapshotUrl, which is a new query key, so the snapshot refetches on its
      // own. It no longer draws pins, but it is what the peek sheet renders.
      queryClient.invalidateQueries({ queryKey: EVENTMAP_MANIFEST_KEY }),
    ]);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] eventmap invalidate failed:', e);
  }

  return true;
}
