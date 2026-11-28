/**
 * Notice dates are KST calendar dates (spec notices/notice-dates): the posting day is read on the KST
 * calendar, so a phone set to New York reads what a phone in Seoul reads. Only the device zone is set.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toPostedMonthDay } from './notice-brief.rules';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/New_York';
});

afterAll(() => {
  // WHY: Node stringifies env values, so assigning undefined would leave TZ as "undefined".
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('notice dates on the KST calendar', () => {
  it('runs in a zone other than KST', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).not.toBe(-540);
  });

  it('reads KST midnight as that KST day, while New York is still on the day before', () => {
    // Act
    const day = toPostedMonthDay('2026-10-19T00:00:00+09:00');

    // Assert
    expect(day).toEqual({ month: 10, day: 19 });
  });
});
