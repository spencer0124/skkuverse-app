/**
 * Event map data hooks.
 *
 * Cold start is two requests; every poll after is one small manifest request
 * that usually 304s. The snapshot carries structure and items together, so
 * toggling a layer or a chip costs no network at all.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventMapManifest, EventMapSnapshot } from '../types/eventmap';
import { useEventMapStore } from '../store/eventmap';
import {
  computeOffset,
  nextBoundaryAfter,
  readUsableOffset,
  serverNow,
} from './clock';
import { buildStacks, deriveItems, selectVisibleStacks } from './derive';
import type { EventMapStack } from './derive';
import type { DroppedCounts } from './parser';
import {
  fetchEventMapManifest,
  fetchEventMapSnapshot,
  readCachedEventMapBundle,
  SnapshotGoneError,
  type EventMapBundle,
} from './repository';

export const EVENTMAP_MANIFEST_KEY = ['eventmap', 'manifest'] as const;

/**
 * The URL already carries `/:layerSetId/:version?lang=`, so keying on it IS
 * version scoping — a new version is a new key, which is what makes
 * `staleTime: Infinity` correct rather than a shortcut.
 */
export const eventMapSnapshotKey = (url: string) => ['eventmap', 'snapshot', url] as const;

/** The server's own manifest memo TTL; polling faster only re-reads the memo. */
const POLL_FLOOR_MS = 15_000;
const POLL_CEIL_MS = 60 * 60_000;
const IDLE_POLL_MS = 5 * 60_000;

/**
 * `setTimeout` stores its delay in a SIGNED 32-BIT int — 2^31-1 ms is about
 * 24.8 days, and anything larger overflows and fires IMMEDIATELY. A manifest
 * emitted outside an event window can put the next boundary a year out, which
 * unclamped becomes a refetch hot loop against the festival-day API.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Fire just past the boundary so `now >= startAt` is already true when we re-derive. */
const BOUNDARY_OVERSHOOT_MS = 1_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function useEventMapManifest() {
  const setClockOffset = useEventMapStore((s) => s.setClockOffset);

  return useQuery<EventMapManifest>({
    queryKey: EVENTMAP_MANIFEST_KEY,
    queryFn: async () => {
      const { manifest, serverDate, age, fetchedAt } = await fetchEventMapManifest();
      // The ONLY place the offset is measured. See clock.ts for why the snapshot
      // response must never be used for this.
      setClockOffset({
        offsetMs: computeOffset(serverDate, age, fetchedAt),
        measuredAt: fetchedAt,
      });
      return manifest;
    },
    // React Query already pauses this on blur and unmount, which a hand-rolled
    // interval would have to reimplement.
    refetchInterval: (query) => {
      const sec = query.state.data?.refreshAfterSec;
      if (typeof sec !== 'number' || !Number.isFinite(sec)) return IDLE_POLL_MS;
      return clamp(sec * 1000, POLL_FLOOR_MS, POLL_CEIL_MS);
    },
    staleTime: 0,
  });
}

export function useEventMapSnapshot(snapshotUrl: string | null) {
  const queryClient = useQueryClient();

  return useQuery<EventMapBundle | null>({
    queryKey: eventMapSnapshotKey(snapshotUrl ?? ''),
    enabled: snapshotUrl !== null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchEventMapSnapshot(snapshotUrl!);
      } catch (error) {
        if (error instanceof SnapshotGoneError) {
          // TTL-reaped. Go back to the manifest exactly once — the "retry" is
          // structural rather than a loop: a moved manifest yields a new
          // snapshotUrl, hence a new query key, hence a fresh fetch on the next
          // render. A manifest still pointing here means the server is
          // inconsistent, and hammering the same dead URL would not help.
          await queryClient.refetchQueries({ queryKey: EVENTMAP_MANIFEST_KEY });
        }
        // Last-known-good, or nothing. Never an error state: a failed event map
        // must leave the base map completely intact.
        return readCachedEventMapBundle();
      }
    },
  });
}

export interface UseEventMapResult {
  snapshot: EventMapSnapshot | null;
  /** Stacks the currently visible layers admit, one marker each. */
  stacks: EventMapStack[];
  /** placeId → stack, for `skkuverse://map?place=<id>`. Covers all stacks, not just visible ones. */
  stacksByPlaceId: Map<string, EventMapStack>;
  dropped: DroppedCounts | null;
  /**
   * Decided, including "there is no event". The deep-link resolver needs that
   * distinction: it must wait for an answer, but not forever.
   */
  isSettled: boolean;
}

export function useEventMap(): UseEventMapResult {
  const manifest = useEventMapManifest();
  const snapshotQuery = useEventMapSnapshot(manifest.data?.snapshotUrl ?? null);

  const layerVisibility = useEventMapStore((s) => s.layerVisibility);
  const storedOffset = useEventMapStore((s) => s.clockOffset);
  const initFromSnapshot = useEventMapStore((s) => s.initFromSnapshot);

  const offsetMs = useMemo(() => readUsableOffset(storedOffset), [storedOffset]);

  /**
   * Bumped when a status boundary passes. Invalidating the manifest is NOT
   * enough on its own: if nothing changed server-side the response is
   * byte-identical, React Query's structural sharing keeps the same object
   * identity, no consumer re-renders — and 18:00 comes and goes with every pin
   * still reading 준비중. This is what forces the memo below to re-run against a
   * fresh clock.
   */
  const [statusEpoch, setStatusEpoch] = useState(0);

  const bundle = snapshotQuery.data ?? null;

  useEffect(() => {
    if (bundle?.snapshot) initFromSnapshot(bundle.snapshot);
  }, [bundle?.snapshot, initFromSnapshot]);

  const derived = useMemo(() => {
    if (!bundle?.snapshot) {
      return { items: [], stacks: [] as EventMapStack[], byPlaceId: new Map<string, EventMapStack>() };
    }
    const items = deriveItems(bundle.snapshot.items, serverNow(offsetMs));
    const { stacks, byPlaceId } = buildStacks(items);
    return { items, stacks, byPlaceId };
    // statusEpoch is a deliberate dependency: it is the signal that the clock
    // crossed a boundary even though no input object changed identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.snapshot, offsetMs, statusEpoch]);

  const visibleStacks = useMemo(() => {
    if (!bundle?.snapshot) return [];
    return selectVisibleStacks({
      stacks: derived.stacks,
      layers: bundle.snapshot.layers,
      layerVisibility,
    });
  }, [bundle?.snapshot, derived.stacks, layerVisibility]);

  // Arm a one-shot timer at the next status change.
  const manifestNextChangeAt = manifest.data?.nextChangeAt ?? null;
  useEffect(() => {
    const now = serverNow(offsetMs);
    // The manifest's value is unavailable in exactly the case the cache exists
    // for — an offline festival — so the local boundary is the load-bearing one
    // and the manifest's is a corroborating hint. Take whichever comes first.
    const local = nextBoundaryAfter(derived.items, now);
    const fromManifest = manifestNextChangeAt ? Date.parse(manifestNextChangeAt) : NaN;
    const candidates = [local, Number.isFinite(fromManifest) ? fromManifest : null].filter(
      (t): t is number => t !== null && t > now,
    );
    if (candidates.length === 0) return;

    const delay = Math.min(...candidates) - now + BOUNDARY_OVERSHOOT_MS;
    const id = setTimeout(() => {
      setStatusEpoch((n) => n + 1);
      // Clamping rather than skipping means a >24.8-day horizon fires early and
      // re-arms: one wasted tick per 24.8 days, versus never re-deriving.
    }, Math.min(delay, MAX_TIMEOUT_MS));
    return () => clearTimeout(id);
  }, [derived.items, manifestNextChangeAt, offsetMs, statusEpoch]);

  const isSettled =
    manifest.isFetched && (manifest.data?.snapshotUrl == null || snapshotQuery.isFetched);

  return {
    snapshot: bundle?.snapshot ?? null,
    stacks: visibleStacks,
    stacksByPlaceId: derived.byPlaceId,
    dropped: bundle?.dropped ?? null,
    isSettled,
  };
}
