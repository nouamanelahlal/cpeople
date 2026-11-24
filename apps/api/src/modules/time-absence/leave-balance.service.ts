import { BadRequestException, Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import {
  balance as computeBalance,
  BLOCKING_STATUSES,
  PENDING_STATUSES,
  toAccrualPeriod,
  type Balance,
} from '@cpeople/shared';
import type { CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import { date } from './leave-calendar.service.js';

/**
 * How many days somebody has (M09 / HR-04).
 *
 * **Never a stored number.** Every balance on every screen is worked out here,
 * from rows that each say where they came from: an opening balance with the date
 * it is true at, the days the rule in force accrues, what has actually been
 * taken, what is waiting for a decision, days carried from last year, and HR's
 * adjustments. Nothing writes a balance anywhere, so nothing can drift.
 *
 * The arithmetic itself is in `@cpeople/shared`, with its own tests, because the
 * request form, this service and the year-end run all have to agree about it.
 */
export interface BalanceLine {
  readonly leaveType: { id: string; code: string; name: string; tracksBalance: boolean };
  readonly entitlementDays?: number;
  readonly accrualPerMonth?: number;
  readonly balance: Balance;
  /** The leave year this is for. */
  readonly year: { from: string; to: string };
  readonly carriedExpiresOn?: string;
}

export interface BalanceStatement {
  readonly employee: { id: string; name: string; number: string; department: string };
  readonly lines: BalanceLine[];
}

@Injectable()
export class LeaveBalanceService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Everything one person has, type by type.
   *
   * Only the types that track a balance: unpaid leave has no balance to be
   * short of, and showing it a row of zeroes would invite the question.
   */
  async statement(
    tx: TenantClient,
    input: { readonly employeeId: string; readonly asAt?: string },
  ): Promise<BalanceStatement> {
    const asAt = input.asAt ?? demoToday();

    const employee = await tx.employee.findUniqueOrThrow({
      where: { id: input.employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        hireDate: true,
        department: { select: { name: true } },
      },
    });

    const settings = await tx.leaveSettings.findFirst({
      select: { leaveYearStart: true, accrualPeriod: true },
    });

    const year = leaveYear(asAt, settings?.leaveYearStart ?? '01-01');
    const accrualPeriod = toAccrualPeriod(settings?.accrualPeriod);

    const types = await tx.leaveType.findMany({
      where: { tracksBalance: true, active: true },
      orderBy: { sortOrder: 'asc' },
    });

    const lines: BalanceLine[] = [];

    for (const type of types) {
      lines.push(
        await this.#line(tx, {
          employeeId: employee.id,
          hireDate: plainDate(employee.hireDate),
          type,
          year,
          asAt,
          accrualPeriod,
        }),
      );
    }

    return {
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        number: employee.employeeNumber,
        department: employee.department?.name ?? '',
      },
      lines,
    };
  }

  /**
   * Days still available for one type, for the warning on the request form.
   *
   * Null where the type does not track a balance or has no entitlement on file:
   * "no such right recorded" and "no days left" are different sentences, and a
   * screen that confused them would be telling somebody they had run out of
   * something they never had.
   */
  async remaining(
    tx: TenantClient,
    input: { readonly employeeId: string; readonly leaveTypeId: string; readonly onDate: string },
  ): Promise<number | null> {
    const type = await tx.leaveType.findUnique({
      where: { id: input.leaveTypeId },
      select: { id: true, code: true, name: true, tracksBalance: true },
    });

    if (!type?.tracksBalance) return null;

    const [employee, settings] = await Promise.all([
      tx.employee.findUnique({
        where: { id: input.employeeId },
        select: { hireDate: true },
      }),
      tx.leaveSettings.findFirst({ select: { leaveYearStart: true, accrualPeriod: true } }),
    ]);

    if (!employee) return null;

    const line = await this.#line(tx, {
      employeeId: input.employeeId,
      hireDate: plainDate(employee.hireDate),
      type,
      year: leaveYear(input.onDate, settings?.leaveYearStart ?? '01-01'),
      asAt: input.onDate,
      accrualPeriod: toAccrualPeriod(settings?.accrualPeriod),
    });

    return line.entitlementDays === undefined && line.accrualPerMonth === undefined
      ? null
      : line.balance.remaining;
  }

  /**
   * HR moving a balance by hand.
   *
   * Insert-only and always with a reason. Putting one right is another
   * adjustment in the other direction, and both stay in the history — which is
   * the only way somebody can be shown why their balance is what it is.
   */
  async adjust(
    tx: TenantClient,
    user: CurrentUser,
    input: {
      readonly employeeId: string;
      readonly leaveTypeId: string;
      readonly days: number;
      readonly reason: string;
      readonly effectiveOn?: string;
    },
  ): Promise<{ id: string }> {
    const reason = input.reason?.trim() ?? '';

    if (reason === '') {
      throw new BadRequestException({ kind: 'reasonRequired', values: {} });
    }

    if (!Number.isFinite(input.days) || input.days === 0) {
      throw new BadRequestException({ kind: 'adjustmentZero', values: {} });
    }

    const employee = await tx.employee.findUniqueOrThrow({
      where: { id: input.employeeId },
      select: { firstName: true, lastName: true },
    });

    const type = await tx.leaveType.findUniqueOrThrow({
      where: { id: input.leaveTypeId },
      select: { name: true, code: true },
    });

    const effectiveOn = input.effectiveOn ?? demoToday();

    const row = await tx.leaveBalanceAdjustment.create({
      data: {
        tenantId: user.tenantId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        days: round(input.days),
        reason: reason.slice(0, 240),
        effectiveOn: date(effectiveOn),
        createdBy: user.name,
        createdRole: user.role,
      },
    });

    await this.audit.record(tx, user, {
      action: 'leave.balanceAdjusted',
      entity: 'employee',
      entityId: input.employeeId,
      summary: `${employee.firstName} ${employee.lastName}: ${signed(input.days)} ${type.code}`,
      diff: [
        { field: 'days', from: '', to: signed(round(input.days)) },
        { field: 'reason', from: '', to: reason },
      ],
    });

    return { id: row.id };
  }

  /** Everything that has moved one person's balance for one type, newest first. */
  async history(
    tx: TenantClient,
    input: { readonly employeeId: string; readonly leaveTypeId?: string },
  ): Promise<
    {
      id: string;
      kind: 'opening' | 'carried' | 'adjustment' | 'taken';
      leaveType: { code: string; name: string };
      days: number;
      on: string;
      reason?: string;
      by?: string;
      requestId?: string;
    }[]
  > {
    const where = {
      employeeId: input.employeeId,
      ...(input.leaveTypeId ? { leaveTypeId: input.leaveTypeId } : {}),
    };

    const [openings, carried, adjustments, requests] = await Promise.all([
      tx.leaveOpeningBalance.findMany({
        where,
        include: { leaveType: { select: { code: true, name: true } } },
      }),
      tx.leaveCarryOver.findMany({
        where,
        include: { leaveType: { select: { code: true, name: true } } },
      }),
      tx.leaveBalanceAdjustment.findMany({
        where,
        include: { leaveType: { select: { code: true, name: true } } },
      }),
      // Only the types that keep a balance: unpaid leave moves no balance, and
      // a row for it here would invite the question of why the figure did not
      // change.
      tx.leaveRequest.findMany({
        where: {
          ...where,
          status: { in: [...BLOCKING_STATUSES] },
          leaveType: { tracksBalance: true },
        },
        include: { leaveType: { select: { code: true, name: true } } },
      }),
    ]);

    const rows = [
      ...openings.map((row) => ({
        id: row.id,
        kind: 'opening' as const,
        leaveType: row.leaveType,
        days: Number(row.days),
        on: plainDate(row.balanceAt),
        ...(row.note ? { reason: row.note } : {}),
        by: row.createdBy,
      })),
      ...carried.map((row) => ({
        id: row.id,
        kind: 'carried' as const,
        leaveType: row.leaveType,
        days: Number(row.days),
        on: `${row.toYear}-01-01`,
        reason: `${Number(row.leftOver)} left over in ${row.fromYear}`,
      })),
      ...adjustments.map((row) => ({
        id: row.id,
        kind: 'adjustment' as const,
        leaveType: row.leaveType,
        days: Number(row.days),
        on: plainDate(row.effectiveOn),
        reason: row.reason,
        by: row.createdBy,
      })),
      ...requests.map((row) => ({
        id: row.id,
        kind: 'taken' as const,
        leaveType: row.leaveType,
        days: -Number(row.dayCount),
        on: plainDate(row.startDate),
        requestId: row.id,
      })),
    ];

    return rows.sort((a, b) => b.on.localeCompare(a.on));
  }

  // --- the work --------------------------------------------------------

  async #line(
    tx: TenantClient,
    input: {
      employeeId: string;
      hireDate: string;
      type: { id: string; code: string; name: string; tracksBalance: boolean };
      year: { from: string; to: string };
      asAt: string;
      accrualPeriod: ReturnType<typeof toAccrualPeriod>;
    },
  ): Promise<BalanceLine> {
    const { year, type } = input;

    const [rule, openings, carried, adjustments, requests] = await Promise.all([
      tx.leaveRule.findFirst({
        where: {
          leaveTypeId: type.id,
          effectiveFrom: { lte: date(input.asAt) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date(input.asAt) } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      // Anything true as at a day on or before the end of this leave year: a
      // balance imported "as at 31 December 2025" is what this year starts from.
      tx.leaveOpeningBalance.findMany({
        where: {
          employeeId: input.employeeId,
          leaveTypeId: type.id,
          balanceAt: { lte: date(year.to) },
        },
        orderBy: { balanceAt: 'desc' },
        take: 1,
      }),
      tx.leaveCarryOver.findFirst({
        where: {
          employeeId: input.employeeId,
          leaveTypeId: type.id,
          toYear: Number(year.from.slice(0, 4)),
        },
      }),
      tx.leaveBalanceAdjustment.findMany({
        where: {
          employeeId: input.employeeId,
          leaveTypeId: type.id,
          effectiveOn: { gte: date(year.from), lte: date(year.to) },
        },
        select: { days: true },
      }),
      tx.leaveRequest.findMany({
        where: {
          employeeId: input.employeeId,
          leaveTypeId: type.id,
          status: { in: [...BLOCKING_STATUSES] },
          startDate: { gte: date(year.from), lte: date(year.to) },
        },
        select: { status: true, dayCount: true },
      }),
    ]);

    const taken = requests
      .filter((row) => !(PENDING_STATUSES as readonly string[]).includes(row.status))
      .reduce((sum, row) => sum + Number(row.dayCount), 0);

    const pending = requests
      .filter((row) => (PENDING_STATUSES as readonly string[]).includes(row.status))
      .reduce((sum, row) => sum + Number(row.dayCount), 0);

    const opening = openings[0];

    const result = computeBalance({
      yearFrom: year.from,
      yearTo: year.to,
      asAt: input.asAt,
      opening: opening ? Number(opening.days) : 0,
      carried: carried ? Number(carried.days) : 0,
      ...(carried?.expiresOn ? { carriedExpiresOn: plainDate(carried.expiresOn) } : {}),
      accrualPerMonth: rule?.accrualPerMonth === null ? null : Number(rule?.accrualPerMonth ?? 0) || null,
      entitlementDays: rule?.entitlementDays === null ? null : Number(rule?.entitlementDays ?? 0) || null,
      accrualPeriod: input.accrualPeriod,
      // Somebody hired in September has not earned a January entitlement.
      accrueFrom: input.hireDate,
      taken,
      pending,
      adjusted: adjustments.reduce((sum, row) => sum + Number(row.days), 0),
    });

    return {
      leaveType: type,
      ...(rule?.entitlementDays !== null && rule?.entitlementDays !== undefined
        ? { entitlementDays: Number(rule.entitlementDays) }
        : {}),
      ...(rule?.accrualPerMonth !== null && rule?.accrualPerMonth !== undefined
        ? { accrualPerMonth: Number(rule.accrualPerMonth) }
        : {}),
      balance: result,
      year,
      ...(carried?.expiresOn ? { carriedExpiresOn: plainDate(carried.expiresOn) } : {}),
    };
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

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
