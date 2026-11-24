import { Injectable, Logger } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { daysByMonth, type LeaveDay } from '@cpeople/shared';
import type { CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { demoToday } from '../../common/time/clock.js';

/**
 * Changes that belong to a month nobody may edit any more (HR-02 open point 13).
 *
 * **A closed payroll month is never reopened** (CLAUDE.md rule 5). So when a
 * change to leave moves days that fall inside one, the difference is written
 * down and carried to the next open month, where the payroll engine will read
 * it. Nothing is corrected in place, and nothing is lost.
 *
 * Written per month, not per request, because a request can straddle a closed
 * December and an open January: the December days become a correction and the
 * January days simply change.
 *
 * **Default, to be confirmed by the payroll expert.** It is the behaviour ConSAP
 * has chosen in the absence of an answer, and it is written down as such in
 * docs/specs/HR-02-open-points.md.
 */
@Injectable()
export class LeaveCorrectionService {
  readonly #log = new Logger(LeaveCorrectionService.name);

  constructor(private readonly audit: AuditService) {}

  /**
   * Compares two counts month by month and carries whatever belongs to a closed
   * month. Returns the corrections written.
   */
  async carry(
    tx: TenantClient,
    user: CurrentUser,
    input: {
      readonly requestId: string;
      readonly employeeId: string;
      readonly leaveTypeId: string;
      readonly before: readonly LeaveDay[];
      readonly after: readonly LeaveDay[];
      readonly reason: string;
    },
  ): Promise<{ month: string; days: number }[]> {
    const before = daysByMonth(input.before);
    const after = daysByMonth(input.after);

    const months = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const carried: { month: string; days: number }[] = [];

    for (const month of months) {
      const difference = round((after[month] ?? 0) - (before[month] ?? 0));
      if (difference === 0) continue;

      const period = await tx.payrollPeriod.findFirst({ where: { month } });

      // An open month — or one payroll has never heard of — simply changes.
      if (!period || period.status === 'open') continue;

      const target = await this.#nextOpenPeriod(tx, user, month);

      const type = await tx.leaveType.findUniqueOrThrow({
        where: { id: input.leaveTypeId },
        select: { paid: true, code: true },
      });

      await tx.leaveCorrection.create({
        data: {
          tenantId: user.tenantId,
          employeeId: input.employeeId,
          requestId: input.requestId,
          leaveTypeId: input.leaveTypeId,
          originalMonth: month,
          appliedPeriodId: target.id,
          dayDifference: difference,
          paid: type.paid,
          reason: input.reason,
          createdBy: user.name,
          createdRole: user.role,
        },
      });

      await this.audit.record(tx, user, {
        action: 'leave.correctionCarried',
        entity: 'leaveRequest',
        entityId: input.requestId,
        summary: `${type.code}: ${signed(difference)} days from ${month}, carried to ${target.month}`,
        diff: [
          { field: 'originalMonth', from: month, to: target.month },
          { field: 'dayDifference', from: '', to: signed(difference) },
        ],
      });

      this.#log.log(
        `Leave correction: ${signed(difference)} days from the closed month ${month} carried to ${target.month}`,
      );

      carried.push({ month, days: difference });
    }

    return carried;
  }

  /**
   * The month the correction lands in: the earliest open one that has not
   * already been and gone.
   *
   * A tenant whose payroll months have not been set up yet gets the current one
   * opened, so that a correction is never dropped for want of a row. HR-03 owns
   * this table properly.
   */
  async #nextOpenPeriod(
    tx: TenantClient,
    user: CurrentUser,
    after: string,
  ): Promise<{ id: string; month: string }> {
    const today = demoToday().slice(0, 7);
    const floor = after > today ? after : today;

    const open = await tx.payrollPeriod.findFirst({
      where: { status: 'open', month: { gte: floor } },
      orderBy: { month: 'asc' },
      select: { id: true, month: true },
    });

    if (open) return open;

    const made = await tx.payrollPeriod.create({
      data: { tenantId: user.tenantId, month: floor, status: 'open' },
      select: { id: true, month: true },
    });

    this.#log.warn(`No open payroll month after ${after}; opened ${made.month} to carry a correction.`);

    return made;
  }
}

function round(value: number): number {
  return Math.round(value * 2) / 2;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
