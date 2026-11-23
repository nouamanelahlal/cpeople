import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { BLOCKING_STATUSES } from '@cpeople/shared';
import { date } from './leave-calendar.service.js';

/**
 * How many days are left (M09 / HR-04).
 *
 * Only as much of a balance as step 2 needs: enough to warn somebody that what
 * they are asking for would take them past what they have. The full statement —
 * opening, accrued, taken, pending, remaining, with HR's adjustments and the
 * opening-balance import — is step 3, and it will read from here rather than
 * grow a second opinion beside it.
 *
 * Two things it already gets right, because changing them later would be a
 * migration rather than an edit:
 *
 *  - **pending days count.** A request waiting for a manager is a claim on the
 *    balance; ignoring it would let somebody spend the same fortnight twice.
 *  - **the entitlement comes from the rule in force**, by date, and is null
 *    rather than zero where a type has no such right. "No annual-leave right on
 *    file" and "no days left" are different sentences.
 */
@Injectable()
export class LeaveBalanceService {
  /**
   * Days still available to this person for this type, or null where the type
   * does not track a balance or has no entitlement on file.
   */
  async remaining(
    tx: TenantClient,
    input: { readonly employeeId: string; readonly leaveTypeId: string; readonly onDate: string },
  ): Promise<number | null> {
    const [type, rule, settings] = await Promise.all([
      tx.leaveType.findUnique({
        where: { id: input.leaveTypeId },
        select: { tracksBalance: true },
      }),
      tx.leaveRule.findFirst({
        where: {
          leaveTypeId: input.leaveTypeId,
          effectiveFrom: { lte: date(input.onDate) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date(input.onDate) } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { entitlementDays: true },
      }),
      tx.leaveSettings.findFirst({ select: { leaveYearStart: true } }),
    ]);

    if (!type?.tracksBalance || rule?.entitlementDays === null || rule?.entitlementDays === undefined) {
      return null;
    }

    const year = leaveYear(input.onDate, settings?.leaveYearStart ?? '01-01');

    const used = await tx.leaveRequest.findMany({
      where: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        status: { in: [...BLOCKING_STATUSES] },
        startDate: { gte: date(year.from), lte: date(year.to) },
      },
      select: { dayCount: true },
    });

    const spent = used.reduce((sum, row) => sum + Number(row.dayCount), 0);

    return round(Number(rule.entitlementDays) - spent);
  }
}

/**
 * The leave year containing a date.
 *
 * The company says which day its leave year starts on; a year starting on
 * 1 July means that 1 June 2027 belongs to the year that began in July 2026.
 */
export function leaveYear(onDate: string, start: string): { from: string; to: string } {
  const year = Number(onDate.slice(0, 4));
  const begins = `${year}-${start}`;

  const from = onDate >= begins ? begins : `${year - 1}-${start}`;
  const to = plusYearMinusDay(from);

  return { from, to };
}

function plusYearMinusDay(from: string): string {
  const next = new Date(`${from}T00:00:00.000Z`);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 2) / 2;
}
