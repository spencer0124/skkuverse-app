/**
 * The GeoJSON → app coordinate seam. The ONLY place `[lng, lat]` is read.
 *
 * ## Why this is a module rather than three inline `.map()` calls
 *
 * An axis swap is the classic failure of this conversion and it never throws:
 * a transposed pair is still two finite numbers, so every layer, cache and
 * renderer reports success while the map draws Seoul in the Yellow Sea. A bug
 * with no exception and no broken-looking output can only be prevented
 * structurally — by having exactly one conversion to get right, and a suite
 * pinned to it. The server takes the same position from the other side and
 * converts NOTHING (`geo/geojson.types.ts`), so the wire is RFC 7946 verbatim
 * end to end and this file is the single translation.
 *
 * The `PolylineCoord` this replaced was `[lat, lng]` — the same shape as a
 * GeoJSON position with the opposite meaning — which is why `LatLng` is a
 * named object. A tuple can be transposed by accident; `{ lat, lng }` cannot.
 *
 * ## What is deliberately NOT here
 *
 * Ring winding. The wire is wound per RFC 7946 §3.1.6 and Naver's polygon
 * overlay wants the opposite, but that is the SDK's convention rather than the
 * wire's, so the reversal lives beside the renderer that needs it —
 * `apps/mobile/src/features/map/utils/overlayGeometry.ts`. Putting it here
 * would bake a Naver rendering detail into the data layer.
 *
 * Contract: skkuverse-server `docs/reference/map-overlays-api.md` §2.4.
 */

import type { LatLng, MapOverlay } from '../types/map';

/**
 * One GeoJSON position → a named coordinate, or `null` if it is not one.
 *
 * `null` rather than a throw or a default, because the caller's answer is
 * always the same: drop the overlay. There is no sensible fallback position for
 * a thing whose position is missing — the old parser's `Number(raw.lat ?? 0)`
 * put such markers at Null Island, which is worse than not drawing them, since
 * `Number(null)` is 0 and the coercion was invisible.
 *
 * The `|lat| <= 90` bound is what makes a transposed pair detectable: Seoul's
 * longitude is 126.97 and cannot be a latitude. It is a tripwire rather than a
 * proof — a swap inside ±90 of both axes passes — so it supplements the
 * single-conversion rule above rather than replacing it.
 *
 * A third element is ignored. RFC 7946 allows altitude as a third position
 * member, and refusing it would drop a position that is spec-valid and
 * perfectly drawable.
 */
export function toLatLng(raw: unknown): LatLng | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw as unknown[];
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * The single point that represents an overlay — where the camera flies when it
 * is deep-linked or picked from the list.
 *
 * DERIVED rather than carried as a field on the overlay, so it cannot disagree
 * with the geometry it summarises. A stored anchor is one more thing an ops
 * edit can leave stale.
 *
 * A marker answers with itself. A zone and a route answer with the centre of
 * their BOUNDING BOX rather than an average of their vertices or a middle
 * index, and the difference is not cosmetic: vertices are unevenly spaced, so a
 * mean drifts toward whichever end was traced in more detail, and a closed
 * ring's repeated first position drags a mean toward that corner. A bounding
 * box is immune to both, and it is the point that actually centres the shape on
 * screen — which is what the camera is being asked for.
 */
export function overlayAnchor(overlay: MapOverlay): LatLng {
  switch (overlay.kind) {
    case 'marker':
      return { lat: overlay.lat, lng: overlay.lng };
    case 'polygon':
      // The exterior ring alone. A hole is inside the outer ring by definition,
      // so it can never move where the zone is.
      return bboxCenter(overlay.rings[0] ?? []);
    case 'path':
      return bboxCenter(overlay.line);
  }
}

/**
 * The centre of the smallest box containing every point.
 *
 * Not exported: it is an implementation detail of `overlayAnchor`, and a second
 * caller wanting "the middle of these points" almost certainly wants a
 * different definition of middle.
 */
function bboxCenter(points: readonly LatLng[]): LatLng {
  // An empty geometry cannot reach here from the parser, which drops an overlay
  // whose ring or line failed to read. Answering Null Island rather than
  // throwing keeps a hand-edited document from taking a whole layer down.
  if (points.length === 0) return { lat: 0, lng: 0 };

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const { lat, lng } of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}
