import { describe, expect, it } from 'vitest';
import {
  decideSchedulePhase,
  hasScheduleDetail,
  toScheduleDateLabel,
  toScheduleDay,
  toScheduleTimeText,
  toScheduleWhen,
} from './notice-schedule.rules';
import type {
  NoticeScheduleDateLabel,
  NoticeScheduleDay,
  NoticeScheduleEntry,
  NoticeScheduleItem,
  NoticeSchedulePoint,
  NoticeScheduleSpan,
} from './notice-schedule.types';

const kst = (iso: string) => new Date(`${iso}+09:00`);
// 2026-11-26 is a Thursday.
const NOW = kst('2026-11-26T14:00:00');

function entry(overrides: Partial<NoticeScheduleEntry> = {}): NoticeScheduleEntry {
  return { id: 'x', title: 'x', status: 'scheduled', occurrences: [], omittedCount: 0, ...overrides };
}

/** WHY: the server fills `occurrences` for a plain item with its own span, so a test spells the span once. */
function plain(start?: NoticeSchedulePoint, end?: NoticeSchedulePoint): NoticeScheduleEntry {
  return entry({ start, end, occurrences: [{ start, end }] });
}

const at = (date: string, time?: string): NoticeSchedulePoint => (time === undefined ? { date } : { date, time });
const day = (month: number, dayOfMonth: number, weekday: number, year: number | null = null): NoticeScheduleDay => ({
  year,
  month,
  day: dayOfMonth,
  weekday,
});

describe('decideSchedulePhase', () => {
  it.each<[string, NoticeScheduleEntry, string]>([
    ['a day before today', plain(at('2026-11-25')), 'past'],
    ['today with no time', plain(at('2026-11-26')), 'ongoing'],
    ['a day after today', plain(at('2026-11-27')), 'upcoming'],
    ['a range that holds today', plain(at('2026-11-24'), at('2026-11-30')), 'ongoing'],
    ['a range that ended yesterday', plain(at('2026-11-20'), at('2026-11-25')), 'past'],
    ['a range that starts tomorrow', plain(at('2026-11-27'), at('2026-11-30')), 'upcoming'],
    ['an end today one minute ahead', plain(at('2026-11-26', '13:00'), at('2026-11-26', '14:01')), 'ongoing'],
    ['an end today now', plain(at('2026-11-26', '13:00'), at('2026-11-26', '14:00')), 'past'],
    ['an end today a minute ago', plain(at('2026-11-26', '13:00'), at('2026-11-26', '13:59')), 'past'],
    ['a start-only time already gone today', plain(at('2026-11-26', '09:00')), 'past'],
    ['a start-only time still ahead today', plain(at('2026-11-26', '18:00')), 'ongoing'],
  ])('reads %s', (_name, input, expected) => {
    // Act
    const phase = decideSchedulePhase(input, NOW);

    // Assert
    expect(phase).toBe(expected);
  });

  it.each<[string, NoticeScheduleEntry, string]>([
    ['a deadline of 24:00 today, still open', plain(undefined, at('2026-11-26', '24:00')), 'ongoing'],
    ['a deadline of 24:00 yesterday, over', plain(undefined, at('2026-11-25', '24:00')), 'past'],
    ['a deadline of 24:00 tomorrow', plain(undefined, at('2026-11-27', '24:00')), 'upcoming'],
    ['a deadline of 13:59 today, over', plain(undefined, at('2026-11-26', '13:59')), 'past'],
    ['a deadline of 14:01 today, open', plain(undefined, at('2026-11-26', '14:01')), 'ongoing'],
    ['a deadline with no time today', plain(undefined, at('2026-11-26')), 'ongoing'],
  ])('reads %s', (_name, input, expected) => {
    // Act
    const phase = decideSchedulePhase(input, NOW);

    // Assert
    expect(phase).toBe(expected);
  });

  it.each<[string, NoticeScheduleEntry, string]>([
    ['a late-November point', plain({ date: '2026-11-21', latest: '2026-11-30' }), 'ongoing'],
    ['a point whose latest day was yesterday', plain({ date: '2026-11-20', latest: '2026-11-25' }), 'past'],
    ['a point whose latest day is today', plain({ date: '2026-11-20', latest: '2026-11-26' }), 'ongoing'],
    ['a point that starts tomorrow', plain({ date: '2026-11-27', latest: '2026-12-05' }), 'upcoming'],
    ['a deadline that falls some day in a range', plain(undefined, { date: '2026-11-20', latest: '2026-11-25' }), 'past'],
  ])('decides on the latest day for %s', (_name, input, expected) => {
    // Act
    const phase = decideSchedulePhase(input, NOW);

    // Assert
    expect(phase).toBe(expected);
  });

  it('reads KST, not UTC, at an instant where the two are on different days', () => {
    // Arrange
    const justAfterMidnight = kst('2026-11-27T00:30:00');
    const deadline = plain(undefined, at('2026-11-26', '24:00'));
    const lateEvening = plain(at('2026-11-26', '22:00'), at('2026-11-26', '23:59'));

    // Act
    const phases = [deadline, lateEvening].map((input) => decideSchedulePhase(input, justAfterMidnight));

    // Assert
    expect(phases).toEqual(['past', 'past']);
  });

  describe('a series', () => {
    const weekly = (dates: string[], omittedCount: number | null) =>
      entry({
        start: at(dates[0], '19:00'),
        end: at(dates[0], '21:00'),
        rrule: { freq: 'weekly', byDay: ['WE'] },
        occurrences: dates.map((date) => ({ start: at(date, '19:00'), end: at(date, '21:00') })),
        omittedCount,
      });

    it.each<[string, NoticeScheduleEntry, string]>([
      ['every listed occurrence past and none left', weekly(['2026-11-04', '2026-11-11'], 0), 'past'],
      ['every listed occurrence past but more beyond the list', weekly(['2026-11-04', '2026-11-11'], 5), 'upcoming'],
      ['every listed occurrence past with no end to the series', weekly(['2026-11-04', '2026-11-11'], null), 'upcoming'],
      ['an occurrence still to come, today not one of them', weekly(['2026-11-04', '2026-12-02'], 0), 'upcoming'],
      ['an occurrence today, before its time', weekly(['2026-11-04', '2026-11-26'], 0), 'ongoing'],
      ['an occurrence today with another still to come', weekly(['2026-11-26', '2026-12-03'], 0), 'ongoing'],
    ])('reads %s', (_name, input, expected) => {
      // Act
      const phase = decideSchedulePhase(input, NOW);

      // Assert
      expect(phase).toBe(expected);
    });

    it('reads today as passed once its occurrence ended and only later ones remain', () => {
      // Arrange
      const evening = kst('2026-11-26T21:30:00');
      const series = entry({
        rrule: { freq: 'weekly', byDay: ['TH'] },
        occurrences: [
          { start: at('2026-11-26', '19:00'), end: at('2026-11-26', '21:00') },
          { start: at('2026-12-03', '19:00'), end: at('2026-12-03', '21:00') },
        ],
      });

      // Act
      const phase = decideSchedulePhase(series, evening);

      // Assert
      expect(phase).toBe('upcoming');
    });

    it('reads the day a skipped date falls on as upcoming, not ongoing', () => {
      // Arrange
      const span = entry({
        start: at('2026-11-24'),
        end: at('2026-11-30'),
        exdate: ['2026-11-26'],
        occurrences: [
          { start: at('2026-11-24'), end: at('2026-11-25', '24:00') },
          { start: at('2026-11-27'), end: at('2026-11-30') },
        ],
      });

      // Act
      const phase = decideSchedulePhase(span, NOW);

      // Assert
      expect(phase).toBe('upcoming');
    });
  });

  it('falls back to the entry itself when the server listed no occurrence', () => {
    // Arrange
    const bare = entry({ start: at('2026-11-20'), end: at('2026-11-25'), occurrences: [] });

    // Act
    const phase = decideSchedulePhase(bare, NOW);

    // Assert
    expect(phase).toBe('past');
  });
});

describe('toScheduleDateLabel', () => {
  it.each<[string, NoticeScheduleSpan, NoticeScheduleDateLabel]>([
    ['today', { start: at('2026-11-26') }, { kind: 'relative', day: 'today' }],
    ['tomorrow', { start: at('2026-11-27') }, { kind: 'relative', day: 'tomorrow' }],
    ['yesterday', { start: at('2026-11-25') }, { kind: 'relative', day: 'yesterday' }],
    ['a later day', { start: at('2026-12-02') }, { kind: 'day', date: day(12, 2, 3) }],
    ['a day in another year', { start: at('2027-01-04') }, { kind: 'day', date: day(1, 4, 1, 2027) }],
    ['a start and an end on one day', { start: at('2026-12-02', '15:00'), end: at('2026-12-02', '17:00') }, { kind: 'day', date: day(12, 2, 3) }],
    [
      'a range over two days',
      { start: at('2026-11-30'), end: at('2026-12-04') },
      { kind: 'range', from: { kind: 'day', date: day(11, 30, 1) }, to: { kind: 'day', date: day(12, 4, 5) } },
    ],
  ])('names %s', (_name, span, expected) => {
    // Act
    const label = toScheduleDateLabel(span, NOW);

    // Assert
    expect(label).toEqual(expected);
  });

  it('keeps a range endpoint a plain day, even when it is today', () => {
    // Act
    const label = toScheduleDateLabel({ start: at('2026-11-26'), end: at('2026-11-30') }, NOW);

    // Assert
    expect(label).toEqual({
      kind: 'range',
      from: { kind: 'day', date: day(11, 26, 4) },
      to: { kind: 'day', date: day(11, 30, 1) },
    });
  });

  it('reads an end alone as a deadline, relative when it is near', () => {
    // Act
    const labels = [
      toScheduleDateLabel({ end: at('2026-11-26', '24:00') }, NOW),
      toScheduleDateLabel({ end: at('2026-12-06', '24:00') }, NOW),
    ];

    // Assert
    expect(labels).toEqual([
      { kind: 'deadline', to: { kind: 'relative', day: 'today' } },
      { kind: 'deadline', to: { kind: 'day', date: day(12, 6, 0) } },
    ]);
  });

  it.each<[string, NoticeScheduleSpan, NoticeScheduleDateLabel]>([
    ['a start after the end', { start: at('2026-12-05'), end: at('2026-12-01') }, { kind: 'day', date: day(12, 5, 6) }],
    [
      'an end before the start on one day',
      { start: at('2026-12-03', '16:00'), end: at('2026-12-03', '09:00') },
      { kind: 'day', date: day(12, 3, 4) },
    ],
  ])('ignores %s', (_name, span, expected) => {
    // Act
    const label = toScheduleDateLabel(span, NOW);

    // Assert
    expect(label).toEqual(expected);
  });

  describe('a point with a latest day', () => {
    const point = (date: string, latest: string): NoticeScheduleSpan => ({ start: { date, latest } });

    it.each<[string, string, string, NoticeScheduleDateLabel]>([
      ['the first ten days', '2026-12-01', '2026-12-10', { kind: 'tenDays', year: null, month: 12, tenDays: 'early' }],
      ['the middle ten days', '2026-12-11', '2026-12-20', { kind: 'tenDays', year: null, month: 12, tenDays: 'mid' }],
      ['the rest of a 31-day month', '2026-12-21', '2026-12-31', { kind: 'tenDays', year: null, month: 12, tenDays: 'late' }],
      ['the rest of a 30-day month', '2026-11-21', '2026-11-30', { kind: 'tenDays', year: null, month: 11, tenDays: 'late' }],
      ['the rest of February', '2027-02-21', '2027-02-28', { kind: 'tenDays', year: 2027, month: 2, tenDays: 'late' }],
      ['the rest of a leap February', '2028-02-21', '2028-02-29', { kind: 'tenDays', year: 2028, month: 2, tenDays: 'late' }],
      ['the first week', '2026-12-01', '2026-12-07', { kind: 'week', year: null, month: 12, week: 1 }],
      ['the second week', '2026-12-08', '2026-12-14', { kind: 'week', year: null, month: 12, week: 2 }],
      ['the third week', '2026-12-15', '2026-12-21', { kind: 'week', year: null, month: 12, week: 3 }],
      ['the fourth week', '2026-12-22', '2026-12-28', { kind: 'week', year: null, month: 12, week: 4 }],
      ['the last seven days of a 31-day month', '2026-12-25', '2026-12-31', { kind: 'lastWeek', year: null, month: 12 }],
      ['the last seven days of a 30-day month', '2026-11-24', '2026-11-30', { kind: 'lastWeek', year: null, month: 11 }],
      ['the last seven days of February, which is also its fourth week', '2027-02-22', '2027-02-28', { kind: 'lastWeek', year: 2027, month: 2 }],
      ['the whole month', '2026-12-01', '2026-12-31', { kind: 'month', year: null, month: 12 }],
      ['the whole of February', '2027-02-01', '2027-02-28', { kind: 'month', year: 2027, month: 2 }],
    ])('names %s', (_name, date, latest, expected) => {
      // Act
      const label = toScheduleDateLabel(point(date, latest), NOW);

      // Assert
      expect(label).toEqual(expected);
    });

    it.each<[string, string, string, NoticeScheduleDateLabel]>([
      [
        'a stretch that is no ten days and no week',
        '2026-12-03',
        '2026-12-09',
        { kind: 'dayRange', from: day(12, 3, 4), to: day(12, 9, 3) },
      ],
      [
        'a stretch across two months',
        '2026-11-25',
        '2026-12-05',
        { kind: 'dayRange', from: day(11, 25, 3), to: day(12, 5, 6) },
      ],
      ['a latest day equal to the date', '2026-12-02', '2026-12-02', { kind: 'day', date: day(12, 2, 3) }],
      ['a latest day before the date', '2026-12-09', '2026-12-02', { kind: 'day', date: day(12, 9, 3) }],
    ])('falls back for %s', (_name, date, latest, expected) => {
      // Act
      const label = toScheduleDateLabel(point(date, latest), NOW);

      // Assert
      expect(label).toEqual(expected);
    });

    it('labels a range from a day to a period', () => {
      // Act
      const label = toScheduleDateLabel(
        { start: at('2026-11-30'), end: { date: '2026-12-21', latest: '2026-12-31' } },
        NOW,
      );

      // Assert
      expect(label).toEqual({
        kind: 'range',
        from: { kind: 'day', date: day(11, 30, 1) },
        to: { kind: 'tenDays', year: null, month: 12, tenDays: 'late' },
      });
    });

    it('labels a deadline that has a latest day', () => {
      // Act
      const label = toScheduleDateLabel({ end: { date: '2026-12-21', latest: '2026-12-31' } }, NOW);

      // Assert
      expect(label).toEqual({ kind: 'deadline', to: { kind: 'tenDays', year: null, month: 12, tenDays: 'late' } });
    });
  });

  describe('a series', () => {
    const series = (rrule: NoticeScheduleEntry['rrule'], start = at('2026-11-26', '19:00')) =>
      entry({ start, rrule });

    it.each<[string, NoticeScheduleEntry, NoticeScheduleDateLabel]>([
      [
        'its byDay days in week order, Sunday last',
        series({ freq: 'weekly', byDay: ['SU', 'TH', 'TU'] }),
        { kind: 'repeat', freq: 'weekly', weekdays: [2, 4, 0], until: null },
      ],
      [
        'the weekday of its start when it has no byDay',
        series({ freq: 'weekly' }),
        { kind: 'repeat', freq: 'weekly', weekdays: [4], until: null },
      ],
      [
        'every day',
        series({ freq: 'daily' }),
        { kind: 'repeat', freq: 'daily', weekdays: [], until: null },
      ],
      [
        'its last day',
        series({ freq: 'weekly', byDay: ['WE'], until: '2026-12-16' }),
        { kind: 'repeat', freq: 'weekly', weekdays: [3], until: day(12, 16, 3) },
      ],
    ])('names %s', (_name, input, expected) => {
      // Act
      const label = toScheduleDateLabel(input, NOW);

      // Assert
      expect(label).toEqual(expected);
    });
  });
});

describe('toScheduleTimeText', () => {
  it.each<[string, NoticeScheduleSpan, string | null]>([
    ['a start and an end time', { start: at('2026-12-02', '15:00'), end: at('2026-12-02', '17:00') }, '15:00–17:00'],
    ['a start time alone', { start: at('2026-12-02', '15:00') }, '15:00'],
    ['a deadline at the end of the day', { end: at('2026-11-23', '24:00') }, '24:00'],
    ['no time', { start: at('2026-12-02') }, null],
    ['a point with a latest day', { start: { date: '2026-12-01', latest: '2026-12-10' } }, null],
    ['an end before its start', { start: at('2026-12-02', '17:00'), end: at('2026-12-02', '15:00') }, '17:00'],
    ['a range with a time at each end', { start: at('2026-12-01', '09:00'), end: at('2026-12-05', '18:00') }, '09:00–18:00'],
  ])('reads %s', (_name, span, expected) => {
    // Act
    const text = toScheduleTimeText(span);

    // Assert
    expect(text).toBe(expected);
  });
});

describe('toScheduleWhen', () => {
  it('attaches an end time alone to the last day of a range', () => {
    // Act
    const when = toScheduleWhen({ start: at('2026-09-23'), end: at('2026-10-13', '17:00') }, NOW);

    // Assert
    expect(when).toEqual({ kind: 'range', from: { kind: 'day', date: day(9, 23, 3) }, fromTime: null, to: { kind: 'day', date: day(10, 13, 2) }, toTime: '17:00' });
  });

  it('attaches each time to its own day when a range spans days', () => {
    // Act
    const when = toScheduleWhen({ start: at('2026-09-23', '10:00'), end: at('2026-10-13', '17:00') }, NOW);

    // Assert
    expect(when).toMatchObject({ kind: 'range', fromTime: '10:00', toTime: '17:00' });
  });

  it('joins the times after the day when both fall on one day', () => {
    // Act
    const when = toScheduleWhen({ start: at('2026-11-13', '16:00'), end: at('2026-11-13', '18:00') }, NOW);

    // Assert
    expect(when).toEqual({ kind: 'at', date: { kind: 'day', date: day(11, 13, 5) }, time: '16:00–18:00' });
  });

  it('attaches the time to the day of a deadline', () => {
    // Act
    const when = toScheduleWhen({ end: at('2026-10-13', '17:00') }, NOW);

    // Assert
    expect(when).toEqual({ kind: 'deadline', to: { kind: 'day', date: day(10, 13, 2) }, time: '17:00' });
  });

  it('keeps the relative day and the repeat rule, with the time after them', () => {
    // Act & Assert
    expect(toScheduleWhen({ start: at('2026-11-26', '15:00') }, NOW)).toEqual({
      kind: 'at',
      date: { kind: 'relative', day: 'today' },
      time: '15:00',
    });
    expect(
      toScheduleWhen({ start: at('2026-12-01', '18:00'), rrule: { freq: 'weekly', byDay: ['TU'] } }, NOW),
    ).toEqual({ kind: 'at', date: { kind: 'repeat', freq: 'weekly', weekdays: [2], until: null }, time: '18:00' });
  });

  it('drops an end before its start, and its time with it', () => {
    // Act
    const when = toScheduleWhen({ start: at('2026-10-13', '17:00'), end: at('2026-10-01', '09:00') }, NOW);

    // Assert
    expect(when).toEqual({ kind: 'at', date: { kind: 'day', date: day(10, 13, 2) }, time: '17:00' });
  });
});

describe('toScheduleDay', () => {
  it('drops the year in the current year only', () => {
    // Act
    const days = [toScheduleDay('2026-11-25', NOW), toScheduleDay('2027-01-04', NOW)];

    // Assert
    expect(days).toEqual([day(11, 25, 3), day(1, 4, 1, 2027)]);
  });
});

describe('hasScheduleDetail', () => {
  const once = at('2026-12-02');
  const part = entry({ id: 'p' });

  it.each<[string, NoticeScheduleItem, boolean]>([
    ['nothing more to show', plain(once), false],
    ['parts', { ...plain(once), parts: [part] }, true],
    ['an empty parts list', { ...plain(once), parts: [] }, false],
    ['more than one occurrence', entry({ start: once, occurrences: [{ start: once }, { start: at('2026-12-09') }] }), true],
    ['a skipped day', { ...plain(once), exdate: ['2026-12-09'] }, true],
    ['a pinned place', { ...plain(once), place: { text: '국제관', name: '국제관', mapTarget: { skkuId: 9, spaceCd: null } } }, true],
    ['an unpinned place', { ...plain(once), place: { text: '온라인', name: null, mapTarget: null } }, false],
    ['omitted occurrences', { ...plain(once), omittedCount: 4 }, true],
  ])('is %s', (_name, input, expected) => {
    // Act
    const result = hasScheduleDetail(input);

    // Assert
    expect(result).toBe(expected);
  });
});
