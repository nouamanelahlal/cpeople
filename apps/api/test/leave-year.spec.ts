import { describe, expect, it } from 'vitest';
import { leaveYear } from '../src/modules/time-absence/leave-balance.service.js';

/**
 * The leave year a date belongs to (M09 / HR-04).
 *
 * The company says which day its leave year starts on, and it is a setting
 * rather than January because it is a question for SMG (HR-02 open points). A
 * balance that used the calendar year where the company uses July would be
 * wrong by however many days somebody took in the first half of the year, and
 * wrong quietly — which is why this is worth its own test.
 */
describe('the leave year containing a date', () => {
  it('is the calendar year when the year starts in January', () => {
    expect(leaveYear('2026-11-23', '01-01')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('includes its first and last day', () => {
    expect(leaveYear('2026-01-01', '01-01').from).toBe('2026-01-01');
    expect(leaveYear('2026-12-31', '01-01').to).toBe('2026-12-31');
  });

  it('runs backwards into the previous year when the year starts in July', () => {
    // June 2027 belongs to the year that began in July 2026.
    expect(leaveYear('2027-06-30', '07-01')).toEqual({ from: '2026-07-01', to: '2027-06-30' });
  });

  it('turns over on the day the year starts', () => {
    expect(leaveYear('2027-07-01', '07-01')).toEqual({ from: '2027-07-01', to: '2028-06-30' });
  });

  it('handles a leap year without losing or gaining a day', () => {
    // 2028 is a leap year: a year starting on 1 March 2027 ends on 29 February.
    expect(leaveYear('2027-03-01', '03-01')).toEqual({ from: '2027-03-01', to: '2028-02-29' });
  });
});
