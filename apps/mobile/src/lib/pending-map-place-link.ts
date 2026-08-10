// Deferred deep-link intent for a map place, mirroring pending-mini-app-link.
// `+native-intent.tsx` runs outside the React tree but shares module state in
// the same JS bundle. External entry (`skkuverse://map?place=<id>` or
// `.../p/map?place=<id>`) → (1) set here, (2) navigate to the campus tab.
// CampusScreen consumes it once mounted and resolves the id against the event
// map snapshot.
//
// Unlike notices and mini-apps this has NO root-layout consumer: only
// CampusScreen can resolve a placeId, and redirectSystemPath has already
// guaranteed the campus tab is the destination, so it is always mounted.
//
// In-app navigation goes through useMapNavStore directly, so no interference.

import { devLog } from '@/services/dev-log';

type Pending = { placeId: string } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingMapPlaceLink = {
  set(p: NonNullable<Pending>) {
    pending = p;
    devLog('pendingMapPlace.set', { placeId: p.placeId, listenerCount: listeners.size });
    listeners.forEach((cb) => {
      cb();
    });
  },
  consume(): Pending {
    const p = pending;
    pending = null;
    devLog('pendingMapPlace.consume', { hasPending: !!p });
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
