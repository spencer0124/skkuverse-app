/**
 * Mini-app data access. The async `MiniAppRepository` interface is the SINGLE
 * swap point for going server-driven: today `localMiniAppRepository` resolves
 * bundled JSON instantly; tomorrow a `remoteMiniAppRepository` does `fetch()` of
 * the same shape and call sites (hooks) don't change.
 *
 * Sync accessors (`*Sync`) exist for two cases the async interface can't serve:
 * React Query `initialData` (no loading flicker in the local era) and
 * `+native-intent.tsx` (runs outside React, must validate a deep-link slug
 * synchronously).
 */
import indexJson from './index.json';
import skkuzineDetail from './details/skkuzine.json';
import skkuwDetail from './details/skkuw.json';
import hsscDetail from './details/hssc.json';
import nscDetail from './details/nsc.json';
import {
  assertValidRegistry,
  type MiniAppDetail,
  type MiniAppIndex,
  type MiniAppIndexEntry,
} from './schema';

// JSON literal types don't narrow the `logo.kind` / generic shapes to our unions,
// so cast after the runtime integrity check below validates them for real.
const index = indexJson as unknown as MiniAppIndex;
const detailMap: Record<string, MiniAppDetail> = {
  skkuzine: skkuzineDetail as unknown as MiniAppDetail,
  skkuw: skkuwDetail as unknown as MiniAppDetail,
  hssc: hsscDetail as unknown as MiniAppDetail,
  nsc: nscDetail as unknown as MiniAppDetail,
};

// Throw loud at module load if the bundled config is malformed (our own data).
assertValidRegistry(index, detailMap);

const sortedIndex: MiniAppIndexEntry[] = [...index.miniApps].sort((a, b) => a.order - b.order);

// ── Sync accessors (local era only) ──
export function getMiniAppIndexSync(): MiniAppIndexEntry[] {
  return sortedIndex;
}
export function getMiniAppDetailSync(id: string): MiniAppDetail | undefined {
  return detailMap[id];
}
export function getMiniAppEntrySync(id: string): MiniAppIndexEntry | undefined {
  return sortedIndex.find((e) => e.id === id);
}
/** Is this a registered mini-app slug? Used by the deep-link router. */
export function isMiniAppId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(detailMap, id);
}

// ── Async repository (server-swap point) ──
export interface MiniAppRepository {
  getIndex(): Promise<MiniAppIndexEntry[]>;
  getDetail(id: string): Promise<MiniAppDetail>;
}

export const localMiniAppRepository: MiniAppRepository = {
  async getIndex() {
    return sortedIndex;
  },
  async getDetail(id) {
    const detail = detailMap[id];
    if (!detail) throw new Error(`Unknown mini-app id: ${id}`);
    return detail;
  },
};

// Flip this to a `remoteMiniAppRepository` when the registry moves server-side.
export const miniAppRepository: MiniAppRepository = localMiniAppRepository;
