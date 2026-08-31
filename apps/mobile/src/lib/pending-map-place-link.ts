// Deferred deep-link intent for a map place, mirroring pending-mini-app-link.
// `+native-intent.tsx` runs outside the React tree but shares module state in
// the same JS bundle. External entry (`skkuverse://map?place=<id>` or
// `.../p/map?place=<id>`) → (1) set here, (2) navigate to the campus tab.
// CampusScreen consumes it once mounted and resolves it — a building directly,
// an event place against the snapshot.
//
// Unlike notices and mini-apps this has NO root-layout consumer: only
// CampusScreen can resolve a placeId, and redirectSystemPath has already
// guaranteed the campus tab is the destination, so it is always mounted.
//
// In-app navigation goes through useMapNavStore directly, so no interference.

import type { MarkerTap } from '@skkuverse/shared';
import { devLog } from '@/services/dev-log';

/**
 * `kind` is `null` for a bare `?place=<id>` link.
 *
 * The agreed format is `<kind>:<placeId>`, which makes the link literally the
 * two fields of a marker's `tap` so it can never disagree with the marker it was
 * copied from. Bare ids are already in circulation, though, and they are all
 * event places — the scheme has never addressed anything else — so `null` means
 * "resolve it the way it has always been resolved" rather than "unknown".
 */
type Pending = { kind: MarkerTap['kind'] | null; placeId: string } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingMapPlaceLink = {
  set(p: NonNullable<Pending>) {
    pending = p;
    devLog('pendingMapPlace.set', {
      kind: p.kind,
      placeId: p.placeId,
      listenerCount: listeners.size,
    });
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
