import { describe, expect, it } from 'vitest';
import {
  accruedDays,
  balance,
  carryOver,
  periodsEarned,
  seniorityBlocks,
  usableFromDate,
  wholeMonthsBetween,
  type BalanceInput,
} from '../src/leave-balance.js';

/**
 * What a balance is made of (M09 / HR-04).
 *
 * The cases here are the ones somebody argues about: a person hired in
 * September, a quarterly accrual, carried days that have run out, and a balance
 * that has gone negative because HR took days away. None of the numbers are
 * law — the rules behind them are settings — but the arithmetic has to be right
 * whatever the settings say.
 */

const BASE: BalanceInput = {
  yearFrom: '2026-01-01',
  yearTo: '2026-12-31',
  asAt: '2026-11-23',
  opening: 0,
  carried: 0,
  accrualPerMonth: 1.5,
  accrualPeriod: 'monthly',
  taken: 0,
  pending: 0,
  adjusted: 0,
};

describe('whole months between two days', () => {
  it('counts the day of the month, not the calendar month', () => {
    expect(wholeMonthsBetween('2026-01-15', '2026-02-14')).toBe(0);
    expect(wholeMonthsBetween('2026-01-15', '2026-02-15')).toBe(1);
  });

  it('counts across a year end', () => {
    expect(wholeMonthsBetween('2026-11-01', '2027-02-01')).toBe(3);
  });

  it('is zero for the same day', () => {
    expect(wholeMonthsBetween('2026-05-05', '2026-05-05')).toBe(0);
  });
});

describe('what has been earned so far', () => {
  it('earns a month at a time', () => {
    // 1 January to 23 November is ten whole months, not eleven.
    expect(periodsEarned(BASE)).toBe(10);
    expect(accruedDays(BASE)).toBe(15);
  });

  it('starts from the hire date for somebody who joined mid-year', () => {
    const joined = { ...BASE, accrueFrom: '2026-09-15' };

    expect(periodsEarned(joined)).toBe(2);
    expect(accruedDays(joined)).toBe(3);
  });

  it('earns nothing before the first whole period is done', () => {
    expect(periodsEarned({ ...BASE, accrueFrom: '2026-11-01' })).toBe(0);
    expect(accruedDays({ ...BASE, accrueFrom: '2026-11-01' })).toBe(0);
  });

  it('earns a quarter at a time where the company says so', () => {
    const quarterly = { ...BASE, accrualPeriod: 'quarterly' as const };

    // Ten whole months is three whole quarters.
    expect(periodsEarned(quarterly)).toBe(3);
    // Three quarters is nine months of accrual.
    expect(accruedDays(quarterly)).toBe(13.5);
  });

  it('grants the whole entitlement where a type does not accrue', () => {
    const granted = { ...BASE, accrualPerMonth: null, entitlementDays: 3 };

    expect(accruedDays(granted)).toBe(3);
  });

  it('stops at the end of the year, not at today when today is later', () => {
    expect(periodsEarned({ ...BASE, asAt: '2027-06-30' })).toBe(12);
  });
});

describe('the statement', () => {
  it('adds up what somebody has and takes away what they used', () => {
    const answer = balance({
      ...BASE,
      opening: 4,
      carried: 2,
      taken: 7,
      pending: 2.5,
      adjusted: 1,
    });

    // 4 opening + 2 carried + 15 accrued + 1 adjusted − 7 taken − 2.5 pending.
    expect(answer.remaining).toBe(12.5);
    expect(answer.accrued).toBe(15);
    expect(answer.carriedExpired).toBe(0);
  });

  it('drops carried days once they have run out', () => {
    const answer = balance({
      ...BASE,
      carried: 5,
      carriedExpiresOn: '2026-03-31',
      taken: 3,
    });

    expect(answer.carried).toBe(0);
    expect(answer.carriedExpired).toBe(5);
    // 15 accrued − 3 taken, with the five carried days gone.
    expect(answer.remaining).toBe(12);
  });

  it('keeps carried days that have not run out yet', () => {
    const answer = balance({ ...BASE, carried: 5, carriedExpiresOn: '2026-12-31' });

    expect(answer.carried).toBe(5);
    expect(answer.carriedExpired).toBe(0);
  });

  it('goes negative rather than pretending', () => {
    // HR taking days away can put somebody under. A balance that refused to go
    // negative would be hiding the thing the screen most needs to show.
    const answer = balance({ ...BASE, accrualPerMonth: 0, taken: 2, adjusted: -5 });

    expect(answer.remaining).toBe(-7);
  });

  it('counts pending days, so the same fortnight cannot be spent twice', () => {
    const answer = balance({ ...BASE, pending: 15 });

    expect(answer.remaining).toBe(0);
  });

  it('rounds to halves and leaves no float dust', () => {
    const answer = balance({ ...BASE, accrualPerMonth: 1.75, taken: 0.5 });

    expect(answer.accrued).toBe(17.5);
    expect(answer.remaining).toBe(17);
  });
});

describe('what carries into the next year', () => {
  it('carries everything where the type says so', () => {
    expect(carryOver({ leftOver: 11.5, mode: 'all' })).toBe(11.5);
  });

  it('carries nothing where the type says so', () => {
    expect(carryOver({ leftOver: 11.5, mode: 'none' })).toBe(0);
  });

  it('carries up to the limit, and no further', () => {
    expect(carryOver({ leftOver: 11.5, mode: 'limited', maxDays: 6 })).toBe(6);
    expect(carryOver({ leftOver: 4, mode: 'limited', maxDays: 6 })).toBe(4);
  });

  it('carries nothing where a limit is meant but none is on file', () => {
    // "Limited by nothing" is not "unlimited": it is a rule somebody has not
    // finished filling in, and the screen says so rather than inventing a limit.
    expect(carryOver({ leftOver: 11.5, mode: 'limited', maxDays: null })).toBe(0);
  });

  it('carries nothing from a balance that is already spent', () => {
    expect(carryOver({ leftOver: 0, mode: 'all' })).toBe(0);
    expect(carryOver({ leftOver: -3, mode: 'all' })).toBe(0);
  });
});

describe('long service (HR-02 build spec §4.1)', () => {
  /** The acceptance case from the spec: hired 3 March 2019, read on 24 November 2026. */
  const veteran: BalanceInput = {
    ...BASE,
    asAt: '2026-11-24',
    accrueFrom: '2019-03-03',
    seniorityFrom: '2019-03-03',
    seniorityBonusDays: 1.5,
    seniorityBonusEveryYears: 5,
    capDays: 30,
  };

  it('counts one completed block after seven years', () => {
    // Seven years and nearly nine months: one completed block of five, not two.
    expect(seniorityBlocks(veteran)).toBe(1);
    expect(balance(veteran).seniority).toBe(1.5);
  });

  it('counts nothing until a block is complete', () => {
    expect(seniorityBlocks({ ...veteran, accrueFrom: '2022-06-01', seniorityFrom: '2022-06-01' })).toBe(0);
  });

  it('counts two blocks after ten years', () => {
    expect(seniorityBlocks({ ...veteran, seniorityFrom: '2016-01-01' })).toBe(2);
  });

  it('adds the bonus to what the year gives', () => {
    const answer = balance(veteran);

    // Ten completed months at 1.5 a day, plus the long-service day and a half.
    expect(answer.accrued).toBe(15);
    expect(answer.seniority).toBe(1.5);
    expect(answer.remaining).toBe(16.5);
  });

  it('never gives more than the cap, bonus included', () => {
    // Four blocks would be 6 extra days on top of 16.5, which is over the cap.
    // Five blocks is 7.5 extra on top of 15, which is over a cap of 18.
    const answer = balance({ ...veteran, seniorityFrom: '2000-01-01', capDays: 18 });

    expect(answer.cappedAt).toBe(18);
    expect(answer.remaining).toBe(18);
  });

  it('does nothing where the rule says nothing', () => {
    const answer = balance({ ...BASE, seniorityBonusDays: null, seniorityBonusEveryYears: null });

    expect(answer.seniority).toBe(0);
    expect(answer.seniorityBlocks).toBe(0);
  });
});

describe('a right that cannot be used yet', () => {
  it('names the day it becomes usable', () => {
    expect(usableFromDate({ ...BASE, accrueFrom: '2026-09-15', usableAfterMonths: 6 })).toBe(
      '2027-03-15',
    );
  });

  it('says so on the balance while the waiting period runs', () => {
    const answer = balance({ ...BASE, accrueFrom: '2026-09-15', usableAfterMonths: 6 });

    expect(answer.usableFrom).toBe('2027-03-15');
    // The days are still earned in the meantime: two whole months of them.
    expect(answer.accrued).toBe(3);
  });

  it('says nothing once the waiting period is over', () => {
    expect(balance({ ...BASE, accrueFrom: '2019-03-03', usableAfterMonths: 6 }).usableFrom).toBeUndefined();
  });

  it('says nothing where the rule has no waiting period', () => {
    expect(balance({ ...BASE, accrueFrom: '2026-09-15' }).usableFrom).toBeUndefined();
  });
});
