/**
 * The notice day arithmetic as it behaves today on a phone in Seoul. Every
 * case passes its own instant; the zone is pinned so the suite reads the same
 * on any machine.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diffDays, formatDisplayDate, formatListDate, startOfLocalDay } from './notice-date.rules';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Asia/Seoul';
});

afterAll(() => {
  // WHY: Node stringifies env values, so assigning undefined would leave TZ as "undefined".
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('localDate', () => {
  it('runs in the KST zone', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).toBe(-540);
  });

  it('starts a day at local midnight', () => {
    // Act
    const start = startOfLocalDay(new Date(2026, 9, 14, 15, 30));

    // Assert
    expect(start).toBe(new Date(2026, 9, 14).getTime());
  });

  it('counts whole days between two midnights', () => {
    // Arrange
    const from = startOfLocalDay(new Date(2026, 9, 14, 9));
    const to = startOfLocalDay(new Date(2026, 9, 25, 22));

    // Act
    const days = diffDays(from, to);

    // Assert
    expect(days).toBe(11);
  });
});

describe('formatListDate', () => {
  it('shows a posting date as zero-padded MM/DD', () => {
    // Assert
    expect(formatListDate('2026-10-14')).toBe('10/14');
    expect(formatListDate('2026-03-05')).toBe('03/05');
  });

  it('gives an empty string for a date it cannot read, so the caller drops the segment', () => {
    // Assert
    expect(formatListDate('2026-10')).toBe('');
    expect(formatListDate('2026-ab-14')).toBe('');
    expect(formatListDate('2026-13-01')).toBe('');
    expect(formatListDate('2026-10-32')).toBe('');
    expect(formatListDate('')).toBe('');
  });
});

describe('formatDisplayDate', () => {
  it('shows a date as YY.MM.DD', () => {
    // Assert
    expect(formatDisplayDate('2026-10-14')).toBe('26.10.14');
  });
});
