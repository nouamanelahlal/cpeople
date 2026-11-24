import { BadRequestException, Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { daysByMonth, type LeaveDay } from '@cpeople/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { plainDate } from '../../common/time/clock.js';

/**
 * The absences a payroll month is entitled to (M09 → M10, HR-04).
 *
 * This is the boundary between time and absence and payroll, and it is
 * deliberately a thin one. It answers one question — what approved absence does
 * this month contain — and it **calculates no pay**. What a day of unpaid leave
 * costs is the payroll engine's business, and the country pack's; this service
 * does not know and must not learn.
 *
 * Three things it does get right, because getting them wrong is a wrong payslip:
 *
 *  - **leave is split by the month it falls in.** A request from 28 December to
 *    4 January is some days in one payroll month and some in another, and the
 *    split comes from the same stored per-day detail that produced the total.
 *  - **the stored calculation is used, not a fresh one.** The approval wrote
 *    down what it approved; asking again today could answer differently, and a
 *    payroll month must be told what was agreed.
 *  - **corrections are carried, never backdated.** A change to a month that is
 *    already closed appears here as a correction on the next open month, with
 *    the request it came from and the reason.
 */
export interface AbsenceLine {
  readonly leaveType: { id: string; code: string; name: string };
  readonly paid: boolean;
  readonly days: number;
  /** The requests these days came from, so a figure can be followed back. */
  readonly requestIds: string[];
}

export interface CorrectionLine {
  readonly id: string;
  readonly leaveType: { id: string; code: string; name: string };
  readonly paid: boolean;
  readonly days: number;
  readonly originalMonth: string;
  readonly requestId: string;
  readonly reason: string;
}

export interface EmployeeAbsences {
  readonly employee: { id: string; number: string; name: string };
  readonly lines: readonly AbsenceLine[];
  readonly corrections: readonly CorrectionLine[];
  /** Everything this employee has in this month, paid and unpaid together. */
  readonly totalDays: number;
}

export interface PeriodAbsences {
  readonly period: string;
  readonly status: 'open' | 'locked' | 'unknown';
  readonly employees: readonly EmployeeAbsences[];
}

@Injectable()
export class AbsencesForPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Approved absence in one payroll month, per employee and per leave type.
   *
   * `period` is a month: "2026-12". Not a date range — payroll is paid a month
   * at a time, and letting a caller ask for an arbitrary window would invite a
   * payslip built from one.
   */
  async forPeriod(tenantId: string, period: string): Promise<PeriodAbsences> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException(`"${period}" is not a payroll month. Use "2026-12".`);
    }

    return this.prisma.forTenant(tenantId, (tx) => this.read(tx, period));
  }

  /** The same, inside a transaction somebody else opened. */
  async read(tx: TenantClient, period: string): Promise<PeriodAbsences> {
    const [first, last] = monthBounds(period);

    const [requests, corrections, payrollPeriod] = await Promise.all([
      // Everything that overlaps the month, because a request that starts in
      // November can still put days into December.
      tx.leaveRequest.findMany({
        where: {
          status: 'approved',
          startDate: { lte: new Date(`${last}T00:00:00.000Z`) },
          endDate: { gte: new Date(`${first}T00:00:00.000Z`) },
        },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, firstName: true, lastName: true },
          },
          leaveType: { select: { id: true, code: true, name: true, paid: true } },
          calculations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { startDate: 'asc' },
      }),
      tx.leaveCorrection.findMany({
        where: { appliedPeriod: { month: period } },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, firstName: true, lastName: true },
          },
          leaveType: { select: { id: true, code: true, name: true, paid: true } },
        },
      }),
      tx.payrollPeriod.findFirst({ where: { month: period }, select: { status: true } }),
    ]);

    const people = new Map<string, Draft>();

    const draft = (employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
    }): Draft => {
      const found = people.get(employee.id);
      if (found) return found;

      const made: Draft = {
        employee: {
          id: employee.id,
          number: employee.employeeNumber,
          name: `${employee.firstName} ${employee.lastName}`,
        },
        lines: new Map(),
        corrections: [],
      };

      people.set(employee.id, made);
      return made;
    };

    for (const request of requests) {
      // What the approval agreed, day by day — not a fresh count.
      const stored = request.calculations[0];
      const days = Array.isArray(stored?.days) ? (stored.days as unknown as LeaveDay[]) : [];

      const thisMonth = days.length > 0 ? (daysByMonth(days)[period] ?? 0) : wholeIfInside(request, period);
      if (thisMonth === 0) continue;

      const row = draft(request.employee);
      const key = request.leaveTypeId;
      const line = row.lines.get(key) ?? {
        leaveType: {
          id: request.leaveType.id,
          code: request.leaveType.code,
          name: request.leaveType.name,
        },
        paid: request.leaveType.paid,
        days: 0,
        requestIds: [] as string[],
      };

      line.days = round(line.days + thisMonth);
      line.requestIds.push(request.id);
      row.lines.set(key, line);
    }

    for (const correction of corrections) {
      const row = draft(correction.employee);

      row.corrections.push({
        id: correction.id,
        leaveType: {
          id: correction.leaveType.id,
          code: correction.leaveType.code,
          name: correction.leaveType.name,
        },
        paid: correction.paid,
        days: Number(correction.dayDifference),
        originalMonth: correction.originalMonth,
        requestId: correction.requestId,
        reason: correction.reason,
      });
    }

    const employees = [...people.values()]
      .map((row) => {
        const lines = [...row.lines.values()];

        return {
          employee: row.employee,
          lines,
          corrections: row.corrections,
          totalDays: round(
            lines.reduce((sum, line) => sum + line.days, 0) +
              row.corrections.reduce((sum, line) => sum + line.days, 0),
          ),
        };
      })
      .sort((a, b) => a.employee.number.localeCompare(b.employee.number));

    return {
      period,
      status: payrollPeriod?.status ?? 'unknown',
      employees,
    };
  }
}

interface Draft {
  employee: { id: string; number: string; name: string };
  lines: Map<string, { leaveType: { id: string; code: string; name: string }; paid: boolean; days: number; requestIds: string[] }>;
  corrections: CorrectionLine[];
}

/**
 * The first and last day of a payroll month.
 *
 * Exported because the correction logic asks the same question, and two answers
 * to "which days are December" is one too many.
 */
export function monthBounds(period: string): [string, string] {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return [`${period}-01`, `${period}-${String(last).padStart(2, '0')}`];
}

/**
 * The fallback for a request with no stored day detail.
 *
 * Should not happen — every request written by this application carries a
 * calculation — but a figure quietly missing from a payroll month would be far
 * worse than one counted roughly, so a request that is wholly inside the month
 * contributes its whole count.
 */
function wholeIfInside(
  request: { startDate: Date; endDate: Date; dayCount: unknown },
  period: string,
): number {
  const [first, last] = monthBounds(period);
  const from = plainDate(request.startDate);
  const to = plainDate(request.endDate);

  return from >= first && to <= last ? Number(request.dayCount) : 0;
}

function round(value: number): number {
  return Math.round(value * 2) / 2;
}
