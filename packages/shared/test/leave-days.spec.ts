import { describe, expect, it } from 'vitest';
import {
  formatLeaveDays,
  halfDayAllowed,
  leaveDays,
  leaveDaysDetail,
  weekday,
  type LeaveCalendar,
} from '../src/leave-days.js';

// How many days a request costs (HR-02 / M08). Everything that shows a number of
// days asks this, so this is where the answer is pinned down.
//
// December 2026 for reference: the 7th is a Monday, the 12th a Saturday, the 13th
// a Sunday. 18 November 2026 is Independence Day, a Wednesday.

/** The head office: Monday to Friday, no public holidays unless said otherwise. */
const OFFICE: LeaveCalendar = {
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  dayBasis: 'working',
};

/** The outlet: open on Saturday too. */
const OUTLET: LeaveCalendar = {
  workingDays: [1, 2, 3, 4, 5, 6],
  holidays: [],
  dayBasis: 'working',
};

describe('HR-02 counting the days of a request', () => {
  it('counts the working days between two dates', () => {
    // Monday to Friday.
    expect(leaveDays({ from: '2026-12-07', to: '2026-12-11' }, OFFICE)).toBe(5);
    // One day.
    expect(leaveDays({ from: '2026-12-07', to: '2026-12-07' }, OFFICE)).toBe(1);
  });

  it('skips the days the site does not work', () => {
    // Monday to the following Monday: the weekend in the middle is not leave.
    expect(leaveDays({ from: '2026-12-07', to: '2026-12-14' }, OFFICE)).toBe(6);

    // The same request for somebody at the outlet, which trades on Saturday.
    expect(leaveDays({ from: '2026-12-07', to: '2026-12-14' }, OUTLET)).toBe(7);
  });

  it('is zero when the whole span is a weekend', () => {
    expect(leaveDays({ from: '2026-12-12', to: '2026-12-13' }, OFFICE)).toBe(0);
  });

  it('skips public holidays, which are entered and never calculated', () => {
    const withHoliday: LeaveCalendar = { ...OFFICE, holidays: ['2026-11-18'] };

    // Monday 16th to Friday 20th, with Independence Day on the Wednesday.
    expect(leaveDays({ from: '2026-11-16', to: '2026-11-20' }, withHoliday)).toBe(4);

    const detail = leaveDaysDetail({ from: '2026-11-16', to: '2026-11-20' }, withHoliday);
    expect(detail.find((day) => day.date === '2026-11-18')).toMatchObject({
      days: 0,
      reason: 'holiday',
    });
  });

  it('counts every day for a type that runs in calendar days', () => {
    const maternity: LeaveCalendar = {
      ...OFFICE,
      dayBasis: 'calendar',
      holidays: ['2026-12-09'],
    };

    // A week is seven days, weekend and holiday included.
    expect(leaveDays({ from: '2026-12-07', to: '2026-12-13' }, maternity)).toBe(7);
  });

  it('takes half a day off the start, the end, or a single day', () => {
    // An afternoon, then two whole days, then a morning: 0.5 + 2 + 0.5.
    expect(
      leaveDays(
        {
          from: '2026-12-07',
          to: '2026-12-10',
          firstDayPart: 'afternoon',
          lastDayPart: 'morning',
        },
        OFFICE,
      ),
    ).toBe(3);

    // One day, one half.
    expect(
      leaveDays({ from: '2026-12-07', to: '2026-12-07', firstDayPart: 'morning' }, OFFICE),
    ).toBe(0.5);
  });

  it('never lets a half-day land on a day that does not count', () => {
    // Friday afternoon to Monday morning: the weekend in between is still zero.
    const detail = leaveDaysDetail(
      {
        from: '2026-12-11',
        to: '2026-12-14',
        firstDayPart: 'afternoon',
        lastDayPart: 'morning',
      },
      OFFICE,
    );

    expect(detail.map((day) => day.days)).toEqual([0.5, 0, 0, 0.5]);
    expect(leaveDays({ from: '2026-12-11', to: '2026-12-14', firstDayPart: 'afternoon', lastDayPart: 'morning' }, OFFICE)).toBe(1);
  });

  it('answers nothing for a span that is not one', () => {
    expect(leaveDays({ from: '2026-12-11', to: '2026-12-07' }, OFFICE)).toBe(0);
    expect(leaveDays({ from: 'tomorrow', to: '2026-12-07' }, OFFICE)).toBe(0);
    expect(leaveDaysDetail({ from: '2026-12-07', to: '' }, OFFICE)).toEqual([]);
  });

  it('gives back halves and never floating-point dust', () => {
    const long = leaveDays(
      { from: '2026-12-07', to: '2027-01-08', firstDayPart: 'afternoon' },
      OFFICE,
    );

    expect(long * 2).toBe(Math.round(long * 2));
  });
});

describe('HR-02 half-days', () => {
  it('allows one marker on a single day, and two across several', () => {
    expect(halfDayAllowed({ from: '2026-12-07', to: '2026-12-07' }, 'first')).toBe(true);
    expect(halfDayAllowed({ from: '2026-12-07', to: '2026-12-07' }, 'last')).toBe(false);
    expect(halfDayAllowed({ from: '2026-12-07', to: '2026-12-09' }, 'last')).toBe(true);
  });

  it('writes the number the way each language does', () => {
    expect(formatLeaveDays(2.5, 'en')).toBe('2.5');
    expect(formatLeaveDays(2.5, 'fr')).toBe('2,5');
    expect(formatLeaveDays(3, 'en')).toBe('3');
  });
});

describe('HR-02 weekdays', () => {
  it('reads a plain date as a day, with no timezone in the way', () => {
    expect(weekday('2026-12-07')).toBe(1); // Monday
    expect(weekday('2026-12-12')).toBe(6); // Saturday
    expect(weekday('2026-12-13')).toBe(0); // Sunday
  });
});
