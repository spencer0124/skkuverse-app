import { EVENTMAP_MANIFEST_KEY } from '@skkuverse/shared';
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
 * How much this actually buys, honestly: in the foreground the manifest query is
 * mounted, so invalidation refetches at once — that is the "within seconds"
 * case. Backgrounded-but-alive only marks it stale until focusManager refocuses.
 * In quit state the handler runs in a throwaway JS context whose cache is empty,
 * so this is a no-op and the next cold start fetches fresh anyway. iOS also
 * throttles apns-priority 5 and delivers nothing to a force-quit app. The real
 * safety net underneath remains `refreshAfterSec` polling plus ETag/304; this is
 * an accelerator on top of it, not a replacement for it.
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
    // The manifest alone: a new version means a new snapshotUrl, which is a new
    // query key, so the snapshot refetches on its own rather than needing its
    // own invalidation.
    await queryClient.invalidateQueries({ queryKey: EVENTMAP_MANIFEST_KEY });
  } catch (e) {
    if (__DEV__) console.warn('[fcm] eventmap invalidate failed:', e);
  }

  return true;
}
