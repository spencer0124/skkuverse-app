/**
 * The event map's date and time strings.
 *
 * Each case is a way the old `toLocaleTimeString` path went wrong without a
 * test to notice: the phone's zone instead of Seoul's, `24:00` at midnight, and
 * the UTC calendar day instead of the KST one.
 */

import { describe, expect, it } from 'vitest';
import {
  formatKstDate,
  formatKstDateTime,
  formatKstTime,
  formatTimeWindow,
} from '../kst-format';
import type { TranslationKey } from '../../i18n/translations';

const KO_WEEKDAY: Partial<Record<TranslationKey, string>> = {
  'day.sun': '일',
  'day.mon': '월',
  'day.tue': '화',
  'day.wed': '수',
  'day.thu': '목',
  'day.fri': '금',
  'day.sat': '토',
};
const t = (key: TranslationKey) => KO_WEEKDAY[key] ?? key;

const at = (iso: string) => Date.parse(iso);

describe('formatKstTime', () => {
  it('reads the KST wall clock from a UTC instant', () => {
    expect(formatKstTime(at('2026-10-01T09:00:00.000Z'))).toBe('18:00');
  });

  it('writes midnight as 00:00, never 24:00', () => {
    expect(formatKstTime(at('2026-10-01T15:00:00.000Z'))).toBe('00:00');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatKstTime(at('2026-10-02T09:05:00+09:00'))).toBe('09:05');
  });
});

describe('formatKstDate', () => {
  it('names both festival days with their weekday', () => {
    expect(formatKstDate(at('2026-10-01T18:00:00+09:00'), t)).toBe('10/1(목)');
    expect(formatKstDate(at('2026-10-02T18:00:00+09:00'), t)).toBe('10/2(금)');
  });

  it('takes the KST calendar day, not the UTC one', () => {
    // 00:30 KST on the 1st is still 15:30 on the 30th in UTC.
    expect(formatKstDateTime(at('2026-09-30T15:30:00.000Z'), t)).toBe('10/1(목) 00:30');
  });

  it('maps Sunday from index 0', () => {
    expect(formatKstDate(at('2026-10-04T12:00:00+09:00'), t)).toBe('10/4(일)');
  });
});

describe('formatTimeWindow', () => {
  it('dates a window by its start', () => {
    expect(
      formatTimeWindow({ startAt: '2026-10-02T12:00:00+09:00', endAt: '2026-10-02T22:00:00+09:00' }, t),
    ).toBe('10/2(금) 12:00–22:00');
  });

  it('keeps a midnight-crossing window on the evening it began', () => {
    expect(
      formatTimeWindow({ startAt: '2026-10-01T09:00:00.000Z', endAt: '2026-10-01T15:00:00.000Z' }, t),
    ).toBe('10/1(목) 18:00–00:00');
  });

  it('is null when a bound does not parse', () => {
    expect(formatTimeWindow({ startAt: 'garbage', endAt: '2026-10-01T15:00:00.000Z' }, t)).toBeNull();
    expect(formatTimeWindow({ startAt: '2026-10-01T09:00:00.000Z', endAt: '' }, t)).toBeNull();
  });
});
