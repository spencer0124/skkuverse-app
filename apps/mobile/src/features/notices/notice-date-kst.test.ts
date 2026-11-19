/**
 * Notice dates are KST calendar dates (spec notices/notice-dates): the first-seen
 * age judges "yesterday" on the KST day of the instant it is given, so a phone set
 * to New York reads what a phone in Seoul reads. Only the device zone is set; every
 * case passes its instant.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toNoticeBriefAge } from './notice-brief.rules';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/New_York';
});

afterAll(() => {
  // WHY: Node stringifies env values, so assigning undefined would leave TZ as "undefined".
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

/** An instant given as a KST wall time, written as UTC (KST is UTC+9). */
const atKst = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(Date.UTC(y, mo - 1, d, h - 9, mi));

describe('notice dates on the KST calendar', () => {
  it('runs in a zone other than KST', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).not.toBe(-540);
  });

  it('ages a notice first seen at 23:00 KST as yesterday at 00:30 KST, while New York sees one day', () => {
    // Act
    const age = toNoticeBriefAge('2026-10-18T23:00:00+09:00', atKst(2026, 10, 19, 0, 30));

    // Assert
    expect(age).toEqual({ kind: 'yesterday' });
  });
});
