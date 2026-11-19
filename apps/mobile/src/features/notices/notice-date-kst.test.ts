/**
 * Notice dates are KST calendar dates (spec notices/notice-dates): the badge
 * and the first-seen age judge "today", "D-n" and "yesterday" on the KST day
 * of the instant they are given, so a phone set to New York reads what a phone in
 * Seoul reads. Only the device zone is set; every case passes its instant.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toNoticeBriefAge } from './notice-brief.rules';
import { formatDeadlineBadge } from './deadline.rules';
import type { NoticeListItemSummary } from './notices.types';

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

const deadline = (date: string): NoticeListItemSummary => ({
  oneLiner: null,
  type: 'action_required',
  startAt: null,
  endAt: { date, time: null, label: null },
});

describe('notice dates on the KST calendar', () => {
  it('runs in a zone other than KST', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).not.toBe(-540);
  });

  it('reads a deadline as due today at 09:00 KST, while New York is still on the day before', () => {
    // Act
    const badge = formatDeadlineBadge(deadline('2026-10-20'), atKst(2026, 10, 20, 9, 0));

    // Assert
    expect(badge?.pill).toEqual({ text: 'D-0', variant: 'urgent' });
  });

  it('reads a date-only deadline as past at 00:30 KST the next day', () => {
    // Act
    const badge = formatDeadlineBadge(deadline('2026-10-20'), atKst(2026, 10, 21, 0, 30));

    // Assert
    expect(badge?.pill).toEqual({ text: '마감', variant: 'closed' });
  });

  it('ages a notice first seen at 23:00 KST as yesterday at 00:30 KST, while New York sees one day', () => {
    // Act
    const age = toNoticeBriefAge('2026-10-18T23:00:00+09:00', atKst(2026, 10, 19, 0, 30));

    // Assert
    expect(age).toEqual({ kind: 'yesterday' });
  });

  it('gives the same badge for the same instant, whatever the wall clock says', () => {
    // Arrange
    const instant = atKst(2026, 10, 18, 12, 0);

    // Act
    const first = formatDeadlineBadge(deadline('2026-10-20'), instant);
    const second = formatDeadlineBadge(deadline('2026-10-20'), instant);

    // Assert
    expect(second).toEqual(first);
    expect(first?.pill).toEqual({ text: 'D-2', variant: 'urgent' });
  });
});
