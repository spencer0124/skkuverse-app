/**
 * Campus proximity.
 *
 * NOTE: apps/mobile runs `node --test` over `src/**\/*.test.mts`, a DIFFERENT
 * runner from packages/shared's vitest. `campusProximity.ts` imports only types
 * from @skkuverse/shared, so `--experimental-strip-types` erases them and the
 * module loads under plain Node with no React or SDK dependency.
 *
 * Coordinates are the real ones the server returns from `GET /map/config`, so a
 * campus moving on the server is a reason for these to be revisited rather than
 * a reason for them to keep passing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CAMPUS_RADIUS_M,
  distanceMeters,
  resolveCampusSuggestion,
} from './campusProximity.ts';
import type { CampusDef } from '@skkuverse/shared';

const HSSC = { lat: 37.587241, lng: 126.992858 };
const NSC = { lat: 37.29358, lng: 126.974942 };

const campus = (over: Partial<CampusDef> & Pick<CampusDef, 'id'>): CampusDef => ({
  label: over.id === 'hssc' ? '인사캠' : '자과캠',
  centerLat: over.id === 'hssc' ? HSSC.lat : NSC.lat,
  centerLng: over.id === 'hssc' ? HSSC.lng : NSC.lng,
  defaultZoom: 15.8,
  defaultTilt: 0,
  defaultBearing: 0,
  ...over,
});

const CAMPUSES: CampusDef[] = [campus({ id: 'hssc' }), campus({ id: 'nsc' })];

/** Metres north of a point, near enough at these latitudes. */
const northOf = (lat: number, metres: number) => lat + metres / 111_320;

describe('distanceMeters', () => {
  it('measures the gap between the two campuses', () => {
    const d = distanceMeters(HSSC.lat, HSSC.lng, NSC.lat, NSC.lng);
    // The measured 32,692m, with room for the earth-radius constant to differ.
    assert.ok(d > 32_000 && d < 33_500, `got ${d}`);
  });

  it('is zero for a point against itself', () => {
    assert.equal(distanceMeters(HSSC.lat, HSSC.lng, HSSC.lat, HSSC.lng), 0);
  });
});

describe('resolveCampusSuggestion', () => {
  it('says nothing while the camera is on the selected campus', () => {
    assert.equal(
      resolveCampusSuggestion({
        cameraLat: HSSC.lat,
        cameraLng: HSSC.lng,
        campuses: CAMPUSES,
        selectedCampus: 'hssc',
      }),
      null,
    );
  });

  it('still says nothing just inside the selected campus radius', () => {
    assert.equal(
      resolveCampusSuggestion({
        cameraLat: northOf(HSSC.lat, DEFAULT_CAMPUS_RADIUS_M - 50),
        cameraLng: HSSC.lng,
        campuses: CAMPUSES,
        selectedCampus: 'hssc',
      }),
      null,
    );
  });

  it('offers a switch when the camera sits on the other campus', () => {
    const s = resolveCampusSuggestion({
      cameraLat: HSSC.lat,
      cameraLng: HSSC.lng,
      campuses: CAMPUSES,
      selectedCampus: 'nsc',
    });
    assert.deepEqual(s, { campus: 'hssc', label: '인사캠', variant: 'switch' });
  });

  it('offers to show the nearest campus when the camera is on neither', () => {
    // Just outside 인사캠, and far from 자과캠.
    const s = resolveCampusSuggestion({
      cameraLat: northOf(HSSC.lat, DEFAULT_CAMPUS_RADIUS_M + 200),
      cameraLng: HSSC.lng,
      campuses: CAMPUSES,
      selectedCampus: 'nsc',
    });
    assert.deepEqual(s, { campus: 'hssc', label: '인사캠', variant: 'show' });
  });

  it('offers the selected campus back when the camera drifts off it', () => {
    // Not a no-op: the toggle does not move, but this is the way home.
    const s = resolveCampusSuggestion({
      cameraLat: northOf(HSSC.lat, DEFAULT_CAMPUS_RADIUS_M + 200),
      cameraLng: HSSC.lng,
      campuses: CAMPUSES,
      selectedCampus: 'hssc',
    });
    assert.deepEqual(s, { campus: 'hssc', label: '인사캠', variant: 'show' });
  });

  it('picks the nearer campus from the midpoint between them', () => {
    const midLat = (HSSC.lat + NSC.lat) / 2;
    const nudgedToNsc = midLat - 0.01;
    const s = resolveCampusSuggestion({
      cameraLat: nudgedToNsc,
      cameraLng: (HSSC.lng + NSC.lng) / 2,
      campuses: CAMPUSES,
      selectedCampus: 'hssc',
    });
    assert.equal(s?.campus, 'nsc');
    assert.equal(s?.variant, 'show');
  });

  it("honours the server's radius over the fallback", () => {
    // A 100m campus: a point 500m out is now outside it, where the 1000m
    // fallback would have called it inside and returned null.
    const tight: CampusDef[] = [campus({ id: 'hssc', radiusM: 100 }), campus({ id: 'nsc' })];
    const s = resolveCampusSuggestion({
      cameraLat: northOf(HSSC.lat, 500),
      cameraLng: HSSC.lng,
      campuses: tight,
      selectedCampus: 'hssc',
    });
    assert.equal(s?.variant, 'show');
  });

  it('says nothing when the config carries no campuses', () => {
    assert.equal(
      resolveCampusSuggestion({
        cameraLat: HSSC.lat,
        cameraLng: HSSC.lng,
        campuses: [],
        selectedCampus: 'hssc',
      }),
      null,
    );
  });
});
