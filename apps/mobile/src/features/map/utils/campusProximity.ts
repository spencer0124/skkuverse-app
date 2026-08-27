/**
 * Is the camera looking at the campus the toggle says is selected?
 *
 * The toggle never moves on its own — it always holds exactly one campus, and
 * only the user changes it. But the camera can leave that campus without asking
 * (the locate button is the ordinary way), and when it does, the map and the
 * toggle say different things. This module decides whether that gap is worth
 * telling the user about, and which of the two things to offer.
 *
 * Deliberately free of React and of the map SDK: it takes plain numbers and
 * returns a plain result, so the decision can be tested against real campus
 * coordinates without a simulator.
 */

import type { Campus, CampusDef } from '@skkuverse/shared';

/**
 * Radius, in metres, treated as "inside a campus" when the server does not say.
 *
 * Derived, not picked. Across all 137 markers the two campus layers return, the
 * furthest building sits 460m from the 인사캠 centre and 487m from the 자과캠
 * one, while the two centres are 32,692m apart. 1000m therefore covers a campus
 * and its immediate surroundings with room to spare, and is 3% of the distance
 * between them — the two circles cannot overlap, so "which campus" is never
 * ambiguous.
 *
 * This stays even after the server ships `radiusM`: an app already on a phone
 * keeps talking to a server that may or may not have the field, and a build
 * predating the deploy has to keep working.
 */
export const DEFAULT_CAMPUS_RADIUS_M = 1000;

/**
 * What to offer when the camera and the toggle disagree.
 *
 * - `switch` — the camera is sitting on the OTHER campus. The user is already
 *   looking at what they want, so this only moves the toggle.
 * - `show` — the camera is on neither campus. Nothing on screen is a campus, so
 *   this both moves the toggle and takes the camera there.
 */
export type CampusSuggestionVariant = 'switch' | 'show';

export interface CampusSuggestion {
  campus: Campus;
  /** Server-driven display text, carried through so no name is written twice. */
  label: string;
  variant: CampusSuggestionVariant;
}

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than an equirectangular approximation: the approximation is
 * cheaper and would be accurate enough at campus scale, but this same function
 * also has to rank a camera that is hundreds of kilometres away, and there is no
 * per-frame cost to protect — it runs once when the camera settles.
 */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

interface ResolveArgs {
  /** The camera's centre, which is what "where am I looking" means here. */
  cameraLat: number;
  cameraLng: number;
  campuses: CampusDef[];
  selectedCampus: Campus;
}

/**
 * Returns the suggestion to show, or `null` when the map and the toggle agree.
 *
 * Three outcomes, in the order they are checked:
 *
 * 1. The camera is inside the selected campus → `null`. Nothing to say.
 * 2. The camera is inside another campus → `switch` for that campus.
 * 3. The camera is inside no campus → `show` for the nearest one, which may be
 *    the campus already selected. That case is not a no-op: the toggle does not
 *    change but the camera comes back, which is the way home from far away.
 */
export function resolveCampusSuggestion({
  cameraLat,
  cameraLng,
  campuses,
  selectedCampus,
}: ResolveArgs): CampusSuggestion | null {
  if (campuses.length === 0) return null;

  let nearest: CampusDef | null = null;
  let nearestDistance = Infinity;
  let inside: CampusDef | null = null;

  for (const campus of campuses) {
    const distance = distanceMeters(
      cameraLat,
      cameraLng,
      campus.centerLat,
      campus.centerLng,
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = campus;
    }
    // The radii cannot overlap (see DEFAULT_CAMPUS_RADIUS_M), so at most one
    // campus can contain the camera and the first match is the only match.
    if (inside === null && distance <= (campus.radiusM ?? DEFAULT_CAMPUS_RADIUS_M)) {
      inside = campus;
    }
  }

  if (inside !== null) {
    if (inside.id === selectedCampus) return null;
    return { campus: inside.id, label: inside.label, variant: 'switch' };
  }

  if (nearest === null) return null;
  return { campus: nearest.id, label: nearest.label, variant: 'show' };
}
