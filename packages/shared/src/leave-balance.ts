import { addDays } from './documents.js';

/**
 * What a balance is made of (M09 / HR-04).
 *
 * Pure arithmetic, in one place, because four things ask it and all four have
 * to agree: the card on somebody's own leave screen, HR's balances table, the
 * warning shown before a request is sent, and the year-end run that decides what
 * carries over. A balance that disagreed with itself between two screens would
 * be worse than no balance at all.
 *
 * **Nothing here is a stored number.** A balance is the sum of rows that each
 * say where they came from — an opening balance with the date it is true at,
 * the days a rule accrues, what was actually taken, what is waiting for a
 * decision, and HR's adjustments. That is what makes it explicable a year later.
 */

/** How often leave is earned. A tenant setting, not a constant. */
export type AccrualPeriod = 'monthly' | 'quarterly' | 'annual';

export const ACCRUAL_PERIODS = ['monthly', 'quarterly', 'annual'] as const;

export function toAccrualPeriod(value: string | null | undefined): AccrualPeriod {
  return (ACCRUAL_PERIODS as readonly string[]).includes(value ?? '')
    ? (value as AccrualPeriod)
    : 'monthly';
}

/** How many months make one accrual period. */
const MONTHS_IN: Record<AccrualPeriod, number> = { monthly: 1, quarterly: 3, annual: 12 };

export interface BalanceInput {
  /** The leave year this balance is for. */
  readonly yearFrom: string;
  readonly yearTo: string;
  /** The day the balance is worked out as at — usually today. */
  readonly asAt: string;

  /** What was brought in: an imported opening balance, and carried days. */
  readonly opening: number;
  readonly carried: number;
  /** The day carried days run out, if they do. */
  readonly carriedExpiresOn?: string;

  /** From the rule in force. Null where the type grants rather than accrues. */
  readonly accrualPerMonth?: number | null;
  /** From the rule in force, where a type simply grants a year's worth. */
  readonly entitlementDays?: number | null;
  readonly accrualPeriod: AccrualPeriod;

  /** The first day this person could accrue: their hire date, where it is later. */
  readonly accrueFrom?: string;

  /** Days on approved requests, and days still waiting for a decision. */
  readonly taken: number;
  readonly pending: number;
  /** HR's adjustments, already summed. Signed. */
  readonly adjusted: number;

  /**
   * Long service: extra days every so many completed years
   * (HR-02 build spec §4.1). Both are settings on the rule, and both are demo
   * values until SMG and the payroll expert have said otherwise.
   */
  readonly seniorityBonusDays?: number | null;
  readonly seniorityBonusEveryYears?: number | null;
  /** The day service started, which is not always the hire date. */
  readonly seniorityFrom?: string;

  /** The most this right may reach in a year, bonus included. */
  readonly capDays?: number | null;
  /** Months of service before the right may be used at all. */
  readonly usableAfterMonths?: number | null;
}

export interface Balance {
  readonly opening: number;
  /** Extra days earned by long service. */
  readonly seniority: number;
  /** Completed blocks of service the bonus counts. */
  readonly seniorityBlocks: number;
  /** Set where the cap cut the entitlement down. */
  readonly cappedAt?: number;
  /** The day this right becomes usable, where it is not usable yet. */
  readonly usableFrom?: string;
  readonly carried: number;
  /** Carried days that have run out and no longer count. */
  readonly carriedExpired: number;
  readonly accrued: number;
  readonly taken: number;
  readonly pending: number;
  readonly adjusted: number;
  /** What is left once everything above is counted. May be negative. */
  readonly remaining: number;
  /** How many whole accrual periods have been earned so far. */
  readonly periodsEarned: number;
}

/**
 * The statement, as a screen shows it.
 *
 * Every line is kept rather than only the total, because "you have 6.5 days"
 * invites an argument and "18 a year, 13.5 earned so far, 7 taken" settles one.
 */
export function balance(input: BalanceInput): Balance {
  const expired =
    input.carriedExpiresOn !== undefined && input.asAt > input.carriedExpiresOn ? input.carried : 0;

  const blocks = seniorityBlocks(input);
  const seniority = blocks * (input.seniorityBonusDays ?? 0);

  // The cap applies to what the year gives — what is accrued plus the long
  // service bonus — and not to what somebody has left after taking some of it.
  const earned = accruedDays(input) + seniority;
  const capped =
    input.capDays === null || input.capDays === undefined
      ? earned
      : Math.min(earned, input.capDays);

  const remaining =
    input.opening + (input.carried - expired) + capped + input.adjusted - input.taken - input.pending;

  const usableFrom = usableFromDate(input);

  return {
    opening: round(input.opening),
    seniority: round(seniority),
    seniorityBlocks: blocks,
    ...(capped < earned ? { cappedAt: round(capped) } : {}),
    ...(usableFrom !== undefined && input.asAt < usableFrom ? { usableFrom } : {}),
    carried: round(input.carried - expired),
    carriedExpired: round(expired),
    accrued: round(capped - seniority),
    taken: round(input.taken),
    pending: round(input.pending),
    adjusted: round(input.adjusted),
    remaining: round(remaining),
    periodsEarned: periodsEarned(input),
  };
}

/**
 * Completed blocks of long service.
 *
 * "Every five completed years" means exactly that: somebody with four years and
 * eleven months has none, and somebody with ten years and a day has two. The
 * service date rather than the hire date, because a transfer or a re-hire can
 * carry service with it.
 */
export function seniorityBlocks(input: BalanceInput): number {
  const every = input.seniorityBonusEveryYears ?? 0;
  const from = input.seniorityFrom ?? input.accrueFrom;

  if (every <= 0 || !input.seniorityBonusDays || from === undefined) return 0;

  return Math.floor(wholeMonthsBetween(from, input.asAt) / 12 / every);
}

/**
 * The day a right becomes usable.
 *
 * Days are earned from the first month; they simply cannot be taken until the
 * waiting period is up. Returning the date rather than a yes or a no is what
 * lets a screen say "usable from 3 September" instead of "not yet".
 */
export function usableFromDate(input: BalanceInput): string | undefined {
  const months = input.usableAfterMonths ?? 0;
  const from = input.accrueFrom;

  if (months <= 0 || from === undefined) return undefined;

  const day = new Date(`${from}T00:00:00.000Z`);
  day.setUTCMonth(day.getUTCMonth() + months);

  return day.toISOString().slice(0, 10);
}

/**
 * What has been earned so far this year.
 *
 * A type with a monthly accrual earns it period by period: on 23 November, ten
 * whole months of a January year have been worked, so ten periods have been
 * earned and not eleven. A type that simply grants a year's worth grants it at
 * the start, which is what `entitlementDays` without an accrual means.
 *
 * Somebody hired in the middle of the year accrues from their hire date, which
 * is why `accrueFrom` exists: a person who started in September has not earned
 * a January-to-September entitlement.
 */
export function accruedDays(input: BalanceInput): number {
  if (input.accrualPerMonth === null || input.accrualPerMonth === undefined) {
    // No accrual on the rule: the entitlement, where there is one, is granted in
    // full at the start of the year.
    return input.entitlementDays ?? 0;
  }

  const months = periodsEarned(input) * MONTHS_IN[input.accrualPeriod];
  return input.accrualPerMonth * months;
}

/** Whole accrual periods between the start of the year (or the hire date) and today. */
export function periodsEarned(input: BalanceInput): number {
  const start = input.accrueFrom && input.accrueFrom > input.yearFrom ? input.accrueFrom : input.yearFrom;

  // Once the year is over the whole of it has been worked, which is a day more
  // than counting to its last day would say: a year running 1 January to
  // 31 December is twelve months, and 31 December is eleven months and thirty
  // days after 1 January.
  const end = input.asAt < input.yearTo ? input.asAt : addDays(input.yearTo, 1);

  if (end < start) return 0;

  const months = wholeMonthsBetween(start, end);
  const size = MONTHS_IN[input.accrualPeriod];

  return Math.max(0, Math.floor(months / size));
}

/**
 * Whole months between two plain dates.
 *
 * "Whole" counts the day of the month: from 15 January to 14 February is not a
 * month, and from 15 January to 15 February is. The alternative — counting
 * calendar months — would give somebody a full month's leave for starting on
 * the 31st.
 */
export function wholeMonthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];

  const months = (ty - fy) * 12 + (tm - fm);
  return td >= fd ? months : months - 1;
}

/** What carries into the next year, once the type's rule is applied. */
export function carryOver(input: {
  readonly leftOver: number;
  readonly mode: 'all' | 'limited' | 'none';
  readonly maxDays?: number | null;
}): number {
  if (input.leftOver <= 0) return 0;

  switch (input.mode) {
    case 'all':
      return round(input.leftOver);
    case 'none':
      return 0;
    case 'limited':
      // No limit on file is not the same as a limit of zero: a `limited` rule
      // with nothing to limit by carries nothing, and says so on the screen.
      return input.maxDays === null || input.maxDays === undefined
        ? 0
        : round(Math.min(input.leftOver, input.maxDays));
    default:
      return 0;
  }
}

/** Halves only: 2.5 is a real answer, 2.4999999 is a floating-point artefact. */
export function round(value: number): number {
  return Math.round(value * 2) / 2;
}
