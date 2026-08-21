// Deferred SDUI action from a notification tap, mirroring pending-mini-app-link.
//
// Why an action needs deferring at all: on a quit-state tap
// `getInitialNotification()` can resolve before the root navigator has a key,
// and `handleSduiAction` pushes immediately. A push against an unmounted
// navigator is silently lost — the same race `pending-external-notice-link`
// exists for. `webview` is ESKARA's primary action type, so this is the main
// path rather than an edge case.
//
// The notifee background handler also writes here, from module scope with no
// React tree at all. That is the second reason this must be a plain module
// holder rather than anything hook-shaped.
//
// RootLayout's PendingSduiActionConsumer drains it once navigation is ready.

import type { NavigableActionType } from '@skkuverse/shared';
import { devLog } from '@/services/dev-log';

type Pending = { actionType: NavigableActionType; actionValue: string } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingSduiAction = {
  set(p: NonNullable<Pending>) {
    pending = p;
    devLog('pendingSduiAction.set', {
      actionType: p.actionType,
      listenerCount: listeners.size,
    });
    listeners.forEach((cb) => {
      cb();
    });
  },
  consume(): Pending {
    const p = pending;
    pending = null;
    devLog('pendingSduiAction.consume', { hasPending: !!p });
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
