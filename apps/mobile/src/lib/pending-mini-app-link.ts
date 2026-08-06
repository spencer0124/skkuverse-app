// Deferred deep-link intent for mini-apps, mirroring pending-external-notice-link.
// `+native-intent.tsx` runs outside the React tree but shares module state in the
// same JS bundle. External entry (`skkuverse://m/<id>` or `.../p/m/<id>`) → (1) set
// here, (2) navigate to home. RootLayout's PendingMiniAppLinkConsumer consumes it
// once navigation is ready and calls openMiniAppById(id).
//
// In-app openMiniAppById() calls don't go through this module, so no interference.

import { devLog } from '@/services/dev-log';

type Pending = { id: string } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingMiniAppLink = {
  set(p: NonNullable<Pending>) {
    pending = p;
    devLog('pendingMiniApp.set', { id: p.id, listenerCount: listeners.size });
    listeners.forEach((cb) => {
      cb();
    });
  },
  consume(): Pending {
    const p = pending;
    pending = null;
    devLog('pendingMiniApp.consume', { hasPending: !!p });
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
