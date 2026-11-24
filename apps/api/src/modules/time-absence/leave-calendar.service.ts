import { Injectable } from '@nestjs/common';
import type { LeaveDayBasis, TenantClient } from '@cpeople/db';
import { leaveDays, leaveDaysDetail, yearsOf, type DayPart, type LeaveDay } from '@cpeople/shared';
import { plainDate } from '../../common/time/clock.js';

/**
 * What a request costs, and everything that decided it (M09 / HR-04).
 *
 * One place works this out, and it hands back not only the number but the rows
 * it used: the rule in force, the site's working week, the exact public
 * holidays, and whether that year's holidays are finished. Those travel with
 * the request as a calculation row.
 *
 * That is the point. A count that is only a number can be argued about a year
 * later and nobody can settle it; a count that carries its evidence can be
 * explained, and a count whose evidence has since changed can be *noticed*,
 * which is what the "to review" list is built on.
 *
 * The weekend fallback below is a fallback and not a rule: where a site has no
 * working week on file, Monday to Friday is assumed and the calculation says so
 * by carrying no work-week id. The demo seeds a week for every site.
 */
const FALLBACK_WORKING_DAYS = [1, 2, 3, 4, 5];

export interface LeaveSpanInput {
  readonly from: string;
  readonly to: string;
  readonly firstDayPart?: DayPart;
  readonly lastDayPart?: DayPart;
}

/** The answer, with its evidence. */
export interface LeaveComputation {
  readonly dayCount: number;
  readonly days: LeaveDay[];
  readonly dayBasis: LeaveDayBasis;
  readonly workingDays: number[];
  readonly workWeekId?: string;
  readonly siteName?: string;
  readonly leaveRuleId?: string;
  readonly holidayIds: string[];
  /** The holidays that actually fell inside the span, for the screens. */
  readonly holidays: { readonly id: string; readonly date: string; readonly name: string }[];
  /** True only when every year the request touches has been marked complete. */
  readonly holidaysComplete: boolean;
  /** The years whose holidays are not finished, for the warning. */
  readonly unconfirmedYears: number[];
  /** From the rule in force, for the notice warning. */
  readonly minNoticeDays: number;
  readonly maxBackdateDays: number;
}

@Injectable()
export class LeaveCalendarService {
  /**
   * Works out one request.
   *
   * `tx` is already inside the tenant, so every row this reads is the tenant's
   * own; there is no way to count somebody else's company's holidays here.
   */
  async compute(
    tx: TenantClient,
    input: {
      readonly employeeId: string;
      readonly leaveTypeId: string;
      readonly span: LeaveSpanInput;
    },
  ): Promise<LeaveComputation> {
    const [employee, type, tenant] = await Promise.all([
      tx.employee.findUniqueOrThrow({
        where: { id: input.employeeId },
        select: { siteId: true, site: { select: { name: true } } },
      }),
      tx.leaveType.findUniqueOrThrow({
        where: { id: input.leaveTypeId },
        select: { dayBasis: true },
      }),
      tx.tenant.findFirstOrThrow({ select: { countryCode: true } }),
    ]);

    const years = yearsOf({ from: input.span.from, to: input.span.to });

    const [workWeek, rule, holidays, completeYears] = await Promise.all([
      employee.siteId
        ? tx.siteWorkWeek.findFirst({
            where: { siteId: employee.siteId, effectiveFrom: { lte: date(input.span.from) } },
            orderBy: { effectiveFrom: 'desc' },
          })
        : Promise.resolve(null),
      tx.leaveRule.findFirst({
        where: {
          leaveTypeId: input.leaveTypeId,
          effectiveFrom: { lte: date(input.span.from) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date(input.span.from) } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      tx.publicHoliday.findMany({
        where: {
          countryCode: tenant.countryCode,
          date: { gte: date(input.span.from), lte: date(input.span.to) },
        },
        orderBy: { date: 'asc' },
      }),
      tx.publicHolidayYear.findMany({
        where: { countryCode: tenant.countryCode, year: { in: years }, complete: true },
        select: { year: true },
      }),
    ]);

    const workingDays = workWeek?.workingDays ?? FALLBACK_WORKING_DAYS;
    const holidayDates = holidays.map((holiday) => plainDate(holiday.date));

    const days = leaveDaysDetail(input.span, {
      workingDays,
      holidays: holidayDates,
      dayBasis: type.dayBasis,
    });

    // Only the holidays that actually took a day off the count are evidence;
    // a holiday on a Sunday the site does not work changed nothing.
    const applied = new Set(
      days.filter((day) => day.reason === 'holiday').map((day) => day.date),
    );
    const used = holidays.filter((holiday) => applied.has(plainDate(holiday.date)));

    const done = new Set(completeYears.map((row) => row.year));
    const unconfirmedYears = years.filter((year) => !done.has(year));

    return {
      dayCount: leaveDays(input.span, {
        workingDays,
        holidays: holidayDates,
        dayBasis: type.dayBasis,
      }),
      days,
      dayBasis: type.dayBasis,
      workingDays: [...workingDays],
      ...(workWeek ? { workWeekId: workWeek.id } : {}),
      ...(employee.site?.name ? { siteName: employee.site.name } : {}),
      ...(rule ? { leaveRuleId: rule.id } : {}),
      holidayIds: used.map((holiday) => holiday.id),
      holidays: used.map((holiday) => ({
        id: holiday.id,
        date: plainDate(holiday.date),
        name: holiday.name,
      })),
      holidaysComplete: unconfirmedYears.length === 0,
      unconfirmedYears,
      minNoticeDays: rule?.minNoticeDays ?? 0,
      maxBackdateDays: rule?.maxBackdateDays ?? 0,
    };
  }
}

/** A plain date as the database wants it: midnight UTC, no time. */
export function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
