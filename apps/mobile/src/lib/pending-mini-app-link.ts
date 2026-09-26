// Deferred deep-link intent for mini-apps, mirroring pending-external-notice-link.
// `+native-intent.tsx` runs outside the React tree but shares module state in the
// same JS bundle. External entry (`skkuverse://m/<target>` or `.../p/m/<target>`,
// a target being `<id>[/path]`) → (1) set here, (2) navigate to home. RootLayout's
// PendingMiniAppLinkConsumer consumes it once navigation is ready and calls
// openMiniAppById(id, path). A push tap naming a mini app lands here too.
//
// In-app openMiniAppById() calls don't go through this module, so no interference.

import type { MiniAppTarget } from '@skkuverse/shared';
import { devLog } from '@/services/dev-log';

type Pending = MiniAppTarget | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingMiniAppLink = {
  set(p: NonNullable<Pending>) {
    pending = p;
    devLog('pendingMiniApp.set', { id: p.id, path: p.path, listenerCount: listeners.size });
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
