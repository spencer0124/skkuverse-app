/**
 * A map place reference — the string that names one place on the map.
 *
 *     [<kind>:]<placeId>
 *
 *     event:eskara-2026-wristband-guest   an event place
 *     skku_building:31                    a campus building
 *     eskara-2026-wristband-guest         bare: an event place, as it always meant
 *
 * One grammar for every way to point at the map: the `skkuverse://map?place=`
 * deep link, a `map` action (server, push, or a first-party page's `web:action`).
 * The prefixed form is literally the two fields of a marker's `tap`, so a shared
 * link can never disagree with the marker it came from; the bare form is what is
 * already in circulation and stays valid.
 */
import type { MarkerTap } from '../types/map';

export interface MapPlaceRef {
  /** `null` for a bare id: resolve it the way it has always been resolved, as an event place. */
  kind: MarkerTap['kind'] | null;
  placeId: string;
}

// BOTH anchors are load-bearing and neither is decoration: they are what stops
// `../../etc` from being accepted as a place id.
const PLACE_REF_RE = /^(?:([a-z0-9_]+):)?([a-z0-9-]+)$/;

// The kinds this build can route. A reference naming anything else is dropped
// rather than stripped down to its id: guessing which kind an unknown prefix
// meant is how a booth link opens the wrong building.
const PLACE_KINDS = ['skku_building', 'event'] as const;

/** Parse a place reference, or null when it is not one this build can route. */
export function parseMapPlaceRef(value: unknown): MapPlaceRef | null {
  // Whitespace is refused before matching: `$` without the `m` flag still
  // matches before a trailing newline, so `event:a\n` would otherwise pass.
  if (typeof value !== 'string' || /\s/.test(value)) return null;
  const match = PLACE_REF_RE.exec(value);
  const rawKind = match?.[1];
  const placeId = match?.[2];
  if (!placeId) return null;
  if (rawKind === undefined) return { kind: null, placeId };
  // A prefix we do not recognise is a reference from a newer build (next year's
  // festival), so drop it rather than resolving the id under the wrong kind.
  const kind = PLACE_KINDS.find((k) => k === rawKind);
  return kind ? { kind, placeId } : null;
}
