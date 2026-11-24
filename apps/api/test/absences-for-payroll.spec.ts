import { describe, expect, it } from 'vitest';
import { daysByMonth, leaveDaysDetail } from '@cpeople/shared';
import { monthBounds } from '../src/modules/time-absence/absences-for-payroll.service.js';

/**
 * What a payroll month is told about absence (M09 → M10, HR-04).
 *
 * The three cases the spec asks for, and they are the three that make a payslip
 * wrong when they are got wrong: leave that crosses a month end, half-days, and
 * a public holiday inside a request.
 *
 * These test the arithmetic that decides the split. The service reads the days
 * from the calculation the approval stored rather than counting again, so what
 * is checked here is exactly what reaches payroll.
 */

/** Monday to Friday, which is the head office and the kitchen. */
const WORKING = { workingDays: [1, 2, 3, 4, 5], holidays: [] as string[], dayBasis: 'working' as const };

describe('the bounds of a payroll month', () => {
  it('knows the length of each month', () => {
    expect(monthBounds('2026-11')).toEqual(['2026-11-01', '2026-11-30']);
    expect(monthBounds('2026-12')).toEqual(['2026-12-01', '2026-12-31']);
    expect(monthBounds('2026-02')).toEqual(['2026-02-01', '2026-02-28']);
  });

  it('knows a leap February', () => {
    expect(monthBounds('2028-02')).toEqual(['2028-02-01', '2028-02-29']);
  });
});

describe('leave across a month end', () => {
  it('puts each day in the month it falls in', () => {
    // Monday 28 December 2026 to Monday 4 January 2027.
    const days = leaveDaysDetail({ from: '2026-12-28', to: '2027-01-04' }, WORKING);
    const split = daysByMonth(days);

    expect(split['2026-12']).toBe(4);
    expect(split['2027-01']).toBe(2);

    // And the two halves add up to the whole, which is the property that
    // matters: nobody is paid for more or fewer days than they took.
    expect((split['2026-12'] ?? 0) + (split['2027-01'] ?? 0)).toBe(
      days.reduce((sum, day) => sum + day.days, 0),
    );
  });

  it('gives a month nothing when the leave only passes over its weekend', () => {
    // Friday 30 October to Monday 2 November, in a company that does not work
    // weekends: October gets the Friday, November gets the Monday.
    const split = daysByMonth(leaveDaysDetail({ from: '2026-10-30', to: '2026-11-02' }, WORKING));

    expect(split).toEqual({ '2026-10': 1, '2026-11': 1 });
  });

  it('leaves a month out altogether when nothing in it counts', () => {
    // Saturday and Sunday only.
    expect(daysByMonth(leaveDaysDetail({ from: '2026-12-05', to: '2026-12-06' }, WORKING))).toEqual({});
  });
});

describe('half-days', () => {
  it('counts a half-day in the month it is taken', () => {
    const split = daysByMonth(
      leaveDaysDetail({ from: '2026-12-31', to: '2027-01-04', firstDayPart: 'afternoon' }, WORKING),
    );

    expect(split['2026-12']).toBe(0.5);
    expect(split['2027-01']).toBe(2);
  });

  it('counts a half-day at each end of a request that crosses the month', () => {
    const split = daysByMonth(
      leaveDaysDetail(
        { from: '2026-11-30', to: '2026-12-02', firstDayPart: 'afternoon', lastDayPart: 'morning' },
        WORKING,
      ),
    );

    // Half of Monday 30 November; Tuesday whole and half of Wednesday.
    expect(split['2026-11']).toBe(0.5);
    expect(split['2026-12']).toBe(1.5);
  });

  it('keeps halves out of the floating-point weeds', () => {
    const split = daysByMonth(
      leaveDaysDetail({ from: '2026-12-07', to: '2026-12-11', lastDayPart: 'morning' }, WORKING),
    );

    expect(split['2026-12']).toBe(4.5);
  });
});

describe('a public holiday inside the leave', () => {
  it('takes the holiday out of the month it falls in', () => {
    // 18 November 2026 is Independence Day, inside a Monday-to-Friday request.
    const withHoliday = daysByMonth(
      leaveDaysDetail(
        { from: '2026-11-16', to: '2026-11-20' },
        { ...WORKING, holidays: ['2026-11-18'] },
      ),
    );

    expect(withHoliday['2026-11']).toBe(4);

    const without = daysByMonth(leaveDaysDetail({ from: '2026-11-16', to: '2026-11-20' }, WORKING));
    expect(without['2026-11']).toBe(5);
  });

  it('takes it out of the right month when the leave crosses the year', () => {
    // 1 January 2027 is a holiday; the December days are untouched by it.
    const split = daysByMonth(
      leaveDaysDetail(
        { from: '2026-12-28', to: '2027-01-04' },
        { ...WORKING, holidays: ['2027-01-01'] },
      ),
    );

    expect(split['2026-12']).toBe(4);
    expect(split['2027-01']).toBe(1);
  });

  it('counts a calendar-day type through the holiday', () => {
    // Maternity and sick leave run in calendar days in most agreements: a
    // holiday inside them is still a day of the absence.
    const split = daysByMonth(
      leaveDaysDetail(
        { from: '2026-11-16', to: '2026-11-20' },
        { ...WORKING, holidays: ['2026-11-18'], dayBasis: 'calendar' },
      ),
    );

    expect(split['2026-11']).toBe(5);
  });
});
