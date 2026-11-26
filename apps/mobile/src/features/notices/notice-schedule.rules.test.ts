import { describe, expect, it } from 'vitest';
import {
  decideSchedulePhase,
  hasScheduleDetail,
  sortNoticeSchedule,
  toScheduleDateLabel,
  toScheduleDay,
  toScheduleTimeText,
} from './notice-schedule.rules';
import type { NoticeScheduleItem } from './notice-schedule.types';

const kst = (iso: string) => new Date(`${iso}+09:00`);
// 2026-11-26 is a Thursday.
const NOW = kst('2026-11-26T14:00:00');

function item(overrides: Partial<NoticeScheduleItem> & { id: string }): NoticeScheduleItem {
  return {
    title: overrides.id,
    start: { date: '2026-11-26' },
    except: [],
    slots: [],
    status: 'scheduled',
    ...overrides,
  };
}

const ids = (items: NoticeScheduleItem[]) => items.map((i) => i.id);

describe('sortNoticeSchedule', () => {
  it('orders by the effective end, so a short deadline is not buried by a long span', () => {
    // Arrange
    const long = item({ id: 'long', start: { date: '2026-11-01' }, end: { date: '2026-12-31' } });
    const deadline = item({ id: 'deadline', start: { date: '2026-12-01', time: '18:00' } });
    const early = item({ id: 'early', start: { date: '2026-11-20' } });

    // Act
    const sorted = sortNoticeSchedule([long, deadline, early]);

    // Assert
    expect(ids(sorted)).toEqual(['early', 'deadline', 'long']);
  });

  it('breaks an effective-end tie by start, then keeps the input order', () => {
    // Arrange
    const lateStart = item({ id: 'a', start: { date: '2026-12-05' }, end: { date: '2026-12-10' } });
    const earlyStart = item({ id: 'b', start: { date: '2026-12-01' }, end: { date: '2026-12-10' } });
    const sameFirst = item({ id: 'c', start: { date: '2026-12-10' } });
    const sameSecond = item({ id: 'd', start: { date: '2026-12-10' } });

    // Act
    const sorted = sortNoticeSchedule([lateStart, earlyStart, sameFirst, sameSecond]);

    // Assert
    expect(ids(sorted)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('orders by time within a day, a day with no time first', () => {
    // Arrange
    const evening = item({ id: 'evening', start: { date: '2026-12-02', time: '18:00' } });
    const morning = item({ id: 'morning', start: { date: '2026-12-02', time: '09:00' } });
    const allDay = item({ id: 'allDay', start: { date: '2026-12-02' } });

    // Act
    const sorted = sortNoticeSchedule([evening, morning, allDay]);

    // Assert
    expect(ids(sorted)).toEqual(['allDay', 'morning', 'evening']);
  });

  it('reads an end before the start as no end', () => {
    // Arrange
    const backwards = item({
      id: 'backwards',
      start: { date: '2026-12-03', time: '16:00' },
      end: { date: '2026-12-03', time: '09:00' },
    });
    const other = item({ id: 'other', start: { date: '2026-12-04' } });

    // Act
    const sorted = sortNoticeSchedule([other, backwards]);

    // Assert
    expect(ids(sorted)).toEqual(['backwards', 'other']);
  });

  it('puts a month at its last day and a week at its seventh', () => {
    // Arrange
    const month = item({ id: 'month', start: { date: '2026-12-01' }, precision: 'month' });
    const week = item({ id: 'week', start: { date: '2026-12-08' }, precision: 'week' });
    const day = item({ id: 'day', start: { date: '2026-12-20' } });
    const lateDay = item({ id: 'lateDay', start: { date: '2026-12-31' } });

    // Act
    const sorted = sortNoticeSchedule([lateDay, month, day, week]);

    // Assert
    expect(ids(sorted)).toEqual(['week', 'day', 'month', 'lateDay']);
  });

  it('does not change its input', () => {
    // Arrange
    const items = [item({ id: 'b', start: { date: '2026-12-02' } }), item({ id: 'a', start: { date: '2026-12-01' } })];

    // Act
    sortNoticeSchedule(items);

    // Assert
    expect(ids(items)).toEqual(['b', 'a']);
  });
});

describe('decideSchedulePhase', () => {
  it.each<[string, NoticeScheduleItem, string]>([
    ['a day before today', item({ id: 'x', start: { date: '2026-11-25' } }), 'past'],
    ['today', item({ id: 'x', start: { date: '2026-11-26' } }), 'ongoing'],
    ['today, before its time', item({ id: 'x', start: { date: '2026-11-26', time: '18:00' } }), 'ongoing'],
    ['a day after today', item({ id: 'x', start: { date: '2026-11-27' } }), 'upcoming'],
    [
      'today, its end time one minute ahead',
      item({ id: 'x', start: { date: '2026-11-26', time: '13:00' }, end: { date: '2026-11-26', time: '14:01' } }),
      'ongoing',
    ],
    [
      'today, its end time now',
      item({ id: 'x', start: { date: '2026-11-26', time: '13:00' }, end: { date: '2026-11-26', time: '14:00' } }),
      'past',
    ],
    [
      'a range that holds today',
      item({ id: 'x', start: { date: '2026-11-24' }, end: { date: '2026-11-30' } }),
      'ongoing',
    ],
    [
      'a range that ended yesterday',
      item({ id: 'x', start: { date: '2026-11-20' }, end: { date: '2026-11-25' } }),
      'past',
    ],
    [
      'a range that starts tomorrow',
      item({ id: 'x', start: { date: '2026-11-27' }, end: { date: '2026-11-30' } }),
      'upcoming',
    ],
    [
      'a range with today skipped, days still to come',
      item({ id: 'x', start: { date: '2026-11-24' }, end: { date: '2026-11-30' }, except: ['2026-11-26'] }),
      'upcoming',
    ],
    [
      'a backwards end reads as the start alone',
      item({ id: 'x', start: { date: '2026-11-26', time: '16:00' }, end: { date: '2026-11-26', time: '09:00' } }),
      'ongoing',
    ],
    ['this month', item({ id: 'x', start: { date: '2026-11-01' }, precision: 'month' }), 'ongoing'],
    ['last month', item({ id: 'x', start: { date: '2026-10-01' }, precision: 'month' }), 'past'],
    ['next month', item({ id: 'x', start: { date: '2026-12-01' }, precision: 'month' }), 'upcoming'],
    ['this week', item({ id: 'x', start: { date: '2026-11-23' }, precision: 'week' }), 'ongoing'],
    ['a week that ended yesterday', item({ id: 'x', start: { date: '2026-11-19' }, precision: 'week' }), 'past'],
    [
      'a daily series inside its span',
      item({ id: 'x', start: { date: '2026-11-20' }, repeat: { freq: 'daily', until: '2026-12-20' } }),
      'ongoing',
    ],
    [
      'a daily series past its until',
      item({ id: 'x', start: { date: '2026-11-01' }, repeat: { freq: 'daily', until: '2026-11-25' } }),
      'past',
    ],
    [
      'a daily series not yet started',
      item({ id: 'x', start: { date: '2026-12-01' }, repeat: { freq: 'daily' } }),
      'upcoming',
    ],
    [
      'a daily series with today skipped',
      item({ id: 'x', start: { date: '2026-11-01' }, repeat: { freq: 'daily' }, except: ['2026-11-26'] }),
      'upcoming',
    ],
    [
      'a weekly series on one of its days (Thursday)',
      item({ id: 'x', start: { date: '2026-11-01' }, repeat: { freq: 'weekly', byDay: ['MO', 'TH'] } }),
      'ongoing',
    ],
    [
      'a weekly series on another day',
      item({ id: 'x', start: { date: '2026-11-01' }, repeat: { freq: 'weekly', byDay: ['MO'] } }),
      'upcoming',
    ],
    [
      'a weekly series with no days, on the start weekday',
      item({ id: 'x', start: { date: '2026-11-19' }, repeat: { freq: 'weekly' } }),
      'ongoing',
    ],
  ])('%s', (_name, scheduleItem, expected) => {
    // Act
    const phase = decideSchedulePhase(scheduleItem, NOW);

    // Assert
    expect(phase).toBe(expected);
  });

  it('reads today in Seoul, not UTC', () => {
    // Arrange
    const justAfterSeoulMidnight = kst('2026-11-27T00:30:00');

    // Act
    const phase = decideSchedulePhase(item({ id: 'x', start: { date: '2026-11-26' } }), justAfterSeoulMidnight);

    // Assert
    expect(phase).toBe('past');
  });
});

describe('toScheduleDateLabel', () => {
  const day = (year: number | null, month: number, d: number, weekday: number) => ({ year, month, day: d, weekday });

  it.each<[string, NoticeScheduleItem, unknown]>([
    ['today', item({ id: 'x', start: { date: '2026-11-26' } }), { kind: 'relative', day: 'today' }],
    ['tomorrow', item({ id: 'x', start: { date: '2026-11-27' } }), { kind: 'relative', day: 'tomorrow' }],
    ['yesterday', item({ id: 'x', start: { date: '2026-11-25' } }), { kind: 'relative', day: 'yesterday' }],
    ['a later day', item({ id: 'x', start: { date: '2026-12-02' } }), { kind: 'day', date: day(null, 12, 2, 3) }],
    ['another year', item({ id: 'x', start: { date: '2027-01-05' } }), { kind: 'day', date: day(2027, 1, 5, 2) }],
    [
      'a range',
      item({ id: 'x', start: { date: '2026-11-24' }, end: { date: '2026-11-30' } }),
      { kind: 'range', from: day(null, 11, 24, 2), to: day(null, 11, 30, 1) },
    ],
    [
      'an end on the start day',
      item({ id: 'x', start: { date: '2026-12-02', time: '15:00' }, end: { date: '2026-12-02', time: '17:00' } }),
      { kind: 'day', date: day(null, 12, 2, 3) },
    ],
    [
      'an end before the start, shown as the start alone',
      item({ id: 'x', start: { date: '2026-12-02', time: '16:00' }, end: { date: '2026-12-02', time: '09:00' } }),
      { kind: 'day', date: day(null, 12, 2, 3) },
    ],
    [
      'an end date before the start date, shown as the start alone',
      item({ id: 'x', start: { date: '2026-12-02' }, end: { date: '2026-12-01' } }),
      { kind: 'day', date: day(null, 12, 2, 3) },
    ],
    ['a month, with no day', item({ id: 'x', start: { date: '2026-12-01' }, precision: 'month' }), { kind: 'month', year: null, month: 12 }],
    ['a month of another year', item({ id: 'x', start: { date: '2027-02-01' }, precision: 'month' }), { kind: 'month', year: 2027, month: 2 }],
    ['the first week', item({ id: 'x', start: { date: '2026-12-01' }, precision: 'week' }), { kind: 'week', year: null, month: 12, week: 1 }],
    ['the second week', item({ id: 'x', start: { date: '2026-12-08' }, precision: 'week' }), { kind: 'week', year: null, month: 12, week: 2 }],
    [
      'a daily series with an until',
      item({ id: 'x', start: { date: '2026-12-01' }, repeat: { freq: 'daily', until: '2026-12-20' } }),
      { kind: 'repeat', freq: 'daily', weekdays: [], until: day(null, 12, 20, 0) },
    ],
    [
      'a daily series with no until',
      item({ id: 'x', start: { date: '2026-12-01' }, repeat: { freq: 'daily' } }),
      { kind: 'repeat', freq: 'daily', weekdays: [], until: null },
    ],
    [
      'a weekly series, its days from Monday',
      item({ id: 'x', start: { date: '2026-12-01' }, repeat: { freq: 'weekly', byDay: ['WE', 'MO', 'SU'] } }),
      { kind: 'repeat', freq: 'weekly', weekdays: [1, 3, 0], until: null },
    ],
    [
      'a weekly series with no days, on the start weekday',
      item({ id: 'x', start: { date: '2026-12-02' }, repeat: { freq: 'weekly' } }),
      { kind: 'repeat', freq: 'weekly', weekdays: [3], until: null },
    ],
  ])('%s', (_name, scheduleItem, expected) => {
    // Act
    const label = toScheduleDateLabel(scheduleItem, NOW);

    // Assert
    expect(label).toEqual(expected);
  });

  it('never names a day for a month', () => {
    // Act
    const label = toScheduleDateLabel(item({ id: 'x', start: { date: '2026-12-01' }, precision: 'month' }), NOW);

    // Assert
    expect(label).not.toHaveProperty('day');
    expect(label).not.toHaveProperty('date');
  });

  it('reads today in Seoul, not UTC', () => {
    // Arrange
    const justAfterSeoulMidnight = kst('2026-11-27T00:30:00');

    // Act
    const label = toScheduleDateLabel(item({ id: 'x', start: { date: '2026-11-27' } }), justAfterSeoulMidnight);

    // Assert
    expect(label).toEqual({ kind: 'relative', day: 'today' });
  });
});

describe('toScheduleDay', () => {
  it('names the weekday, and the year only when it is not this year', () => {
    // Act & Assert
    expect(toScheduleDay('2026-12-09', NOW)).toEqual({ year: null, month: 12, day: 9, weekday: 3 });
    expect(toScheduleDay('2027-01-05', NOW)).toEqual({ year: 2027, month: 1, day: 5, weekday: 2 });
  });
});

describe('toScheduleTimeText', () => {
  it.each<[string, NoticeScheduleItem, string | null]>([
    ['no time', item({ id: 'x' }), null],
    ['a start time', item({ id: 'x', start: { date: '2026-12-02', time: '15:00' } }), '15:00'],
    [
      'a start and an end time',
      item({ id: 'x', start: { date: '2026-12-02', time: '15:00' }, end: { date: '2026-12-02', time: '17:00' } }),
      '15:00–17:00',
    ],
    [
      'an end before the start',
      item({ id: 'x', start: { date: '2026-12-02', time: '16:00' }, end: { date: '2026-12-02', time: '09:00' } }),
      '16:00',
    ],
    ['midnight as stored', item({ id: 'x', start: { date: '2026-12-02', time: '00:00' } }), '00:00'],
    ['an end time with no start time', item({ id: 'x', end: { date: '2026-12-03', time: '18:00' } }), null],
  ])('%s', (_name, scheduleItem, expected) => {
    // Act
    const text = toScheduleTimeText(scheduleItem);

    // Assert
    expect(text).toBe(expected);
  });
});

describe('hasScheduleDetail', () => {
  const slot = { start: { date: '2026-11-26' }, text: 'a' };

  it.each<[string, NoticeScheduleItem, boolean]>([
    ['nothing more', item({ id: 'x' }), false],
    ['a slot', item({ id: 'x', slots: [slot] }), true],
    ['a quote', item({ id: 'x', quote: 'q' }), true],
    ['an except day', item({ id: 'x', except: ['2026-11-27'] }), true],
    ['a pinned place', item({ id: 'x', place: { text: 'p', name: 'n', mapTarget: { skkuId: 9, spaceCd: null } } }), true],
    ['an unpinned place', item({ id: 'x', place: { text: 'p', name: null, mapTarget: null } }), false],
  ])('%s', (_name, scheduleItem, expected) => {
    // Act
    const result = hasScheduleDetail(scheduleItem);

    // Assert
    expect(result).toBe(expected);
  });
});
