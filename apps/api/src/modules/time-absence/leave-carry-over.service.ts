import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { CarryOverMode } from '@cpeople/db';
import { carryOver as applyRule } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday } from '../../common/time/clock.js';
import { LeaveBalanceService, leaveYear } from './leave-balance.service.js';
import { date } from './leave-calendar.service.js';

/**
 * Year end: what is left, and what survives into the new year (M09 / HR-04).
 *
 * Three properties, and each of them is the answer to a way this could go
 * wrong:
 *
 *  - **It is previewed before it is applied.** A year-end run moves every
 *    balance in the company at once. Nobody should press that without seeing
 *    the list first, so the preview writes a run row and the figures it would
 *    produce, and touches no balance.
 *  - **It can be run again safely.** One row per person per type per year, on a
 *    unique key: a second pass replaces the figure rather than adding to it. A
 *    half-finished run, a corrected rule, a late adjustment — all of them are
 *    fixed by running it again.
 *  - **Carried days can expire.** How many carry and how long they last are
 *    both settings on the leave type's rule, and both are demo values waiting
 *    for SMG (HR-02 open points 1 and 15).
 *
 * TODO(M18): this runs in the request that asks for it, which is fine for a
 * company of a few hundred. When Redis and BullMQ arrive it becomes a queued
 * job; the shape here — a run row, a preview, an idempotent apply — is already
 * the shape a worker would want.
 */
@Injectable()
export class LeaveCarryOverService {
  readonly #log = new Logger(LeaveCarryOverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly balances: LeaveBalanceService,
  ) {}

  /** What the last run of each kind did, for the screen. */
  async runs(): Promise<
    {
      id: string;
      fromYear: number;
      status: string;
      employees: number;
      carried: number;
      lost: number;
      startedAt: string;
      finishedAt?: string;
      byName: string;
    }[]
  > {
    const user = await this.#mayManage();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const rows = await tx.leaveCarryOverRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      });

      return rows.map((row) => ({
        id: row.id,
        fromYear: row.fromYear,
        status: row.status,
        employees: row.employees,
        carried: Number(row.carried),
        lost: Number(row.lost),
        startedAt: row.startedAt.toISOString(),
        ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
        byName: row.byName,
      }));
    });
  }

  /** Works out what would carry, and writes nothing to anybody's balance. */
  async preview(fromYear: number): Promise<CarryOverResult> {
    return this.#run(fromYear, 'preview');
  }

  /** Does it. Running it twice leaves the same rows, not twice the days. */
  async apply(fromYear: number): Promise<CarryOverResult> {
    return this.#run(fromYear, 'applied');
  }

  async #run(fromYear: number, status: 'preview' | 'applied'): Promise<CarryOverResult> {
    const user = await this.#mayManage();

    if (!Number.isInteger(fromYear) || fromYear < 2000 || fromYear > 2100) {
      throw new BadRequestException({ kind: 'notAYear', values: {} });
    }

    const today = demoToday();
    if (`${fromYear}` >= today.slice(0, 4) && status === 'applied') {
      // Carrying a year over before it has ended would carry days somebody has
      // not finished earning.
      throw new BadRequestException({ kind: 'yearNotOver', values: { year: String(fromYear) } });
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const settings = await tx.leaveSettings.findFirst({ select: { leaveYearStart: true } });
      const start = settings?.leaveYearStart ?? '01-01';
      const year = leaveYear(`${fromYear}-${start}`, start);

      const run = await tx.leaveCarryOverRun.create({
        data: {
          tenantId: user.tenantId,
          fromYear,
          status,
          byName: user.name,
          byRole: user.role,
        },
      });

      const types = await tx.leaveType.findMany({
        where: { tracksBalance: true, active: true },
        orderBy: { sortOrder: 'asc' },
      });

      const employees = await tx.employee.findMany({
        where: { status: { in: ['active', 'onboarding'] } },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        orderBy: { employeeNumber: 'asc' },
      });

      const lines: CarryOverLine[] = [];
      let carried = 0;
      let lost = 0;

      for (const employee of employees) {
        // The balance as at the last day of the year being closed: what was
        // left when the year ended, not what is left today.
        const statement = await this.balances.statement(tx, {
          employeeId: employee.id,
          asAt: year.to,
        });

        for (const type of types) {
          const line = statement.lines.find((row) => row.leaveType.id === type.id);
          if (!line) continue;

          const leftOver = line.balance.remaining;
          if (leftOver <= 0) continue;

          const rule = await tx.leaveRule.findFirst({
            where: {
              leaveTypeId: type.id,
              effectiveFrom: { lte: date(year.to) },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: date(year.to) } }],
            },
            orderBy: { effectiveFrom: 'desc' },
          });

          const mode: CarryOverMode = rule?.carryOverMode ?? 'limited';
          const days = applyRule({
            leftOver,
            mode,
            maxDays: rule?.carryOverMaxDays === null ? null : Number(rule?.carryOverMaxDays ?? 0),
          });

          const expiresOn = expiry(year.to, rule?.carryOverExpiryMonths ?? null);

          lines.push({
            employee: {
              id: employee.id,
              name: `${employee.firstName} ${employee.lastName}`,
              number: employee.employeeNumber,
            },
            leaveType: { id: type.id, code: type.code, name: type.name },
            leftOver,
            days,
            mode,
            ...(expiresOn ? { expiresOn } : {}),
          });

          carried += days;
          lost += leftOver - days;

          if (status === 'applied') {
            // The unique key is what makes a second run safe: the same person,
            // the same type, the same year is the same row.
            await tx.leaveCarryOver.upsert({
              where: {
                tenantId_employeeId_leaveTypeId_fromYear: {
                  tenantId: user.tenantId,
                  employeeId: employee.id,
                  leaveTypeId: type.id,
                  fromYear,
                },
              },
              create: {
                tenantId: user.tenantId,
                employeeId: employee.id,
                leaveTypeId: type.id,
                fromYear,
                toYear: fromYear + 1,
                leftOver,
                days,
                ...(expiresOn ? { expiresOn: date(expiresOn) } : {}),
                runId: run.id,
              },
              update: {
                leftOver,
                days,
                ...(expiresOn ? { expiresOn: date(expiresOn) } : { expiresOn: null }),
                runId: run.id,
              },
            });
          }
        }
      }

      const people = new Set(lines.map((line) => line.employee.id)).size;

      await tx.leaveCarryOverRun.update({
        where: { id: run.id },
        data: {
          employees: people,
          carried: round(carried),
          lost: round(lost),
          finishedAt: new Date(),
        },
      });

      if (status === 'applied') {
        await this.audit.record(tx, user, {
          action: 'leave.carryOverApplied',
          entity: 'leaveCarryOverRun',
          entityId: run.id,
          summary: `${fromYear} → ${fromYear + 1}: ${people} people, ${round(carried)} days carried`,
          diff: [
            { field: 'carried', from: '', to: String(round(carried)) },
            { field: 'lost', from: '', to: String(round(lost)) },
          ],
        });

        this.#log.log(`Carry-over ${fromYear} applied: ${people} people, ${round(carried)} days`);
      }

      return {
        runId: run.id,
        fromYear,
        toYear: fromYear + 1,
        status,
        employees: people,
        carried: round(carried),
        lost: round(lost),
        lines: lines.sort((a, b) => a.employee.number.localeCompare(b.employee.number)),
      };
    });
  }

  async #mayManage(): Promise<CurrentUser> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return user;
  }
}

export interface CarryOverLine {
  readonly employee: { id: string; name: string; number: string };
  readonly leaveType: { id: string; code: string; name: string };
  /** What was left when the year ended. */
  readonly leftOver: number;
  /** What survives the rule. */
  readonly days: number;
  readonly mode: CarryOverMode;
  readonly expiresOn?: string;
}

export interface CarryOverResult {
  readonly runId: string;
  readonly fromYear: number;
  readonly toYear: number;
  readonly status: 'preview' | 'applied';
  readonly employees: number;
  readonly carried: number;
  readonly lost: number;
  readonly lines: readonly CarryOverLine[];
}

/**
 * The day carried days run out, where the rule says they do.
 *
 * Counted from the first day of the new year, not from the last day of the old
 * one: "carried days last six months" means they last until the end of June,
 * and measuring from 31 December would land on 1 July.
 */
function expiry(yearEnd: string, months: number | null): string | undefined {
  if (months === null || months <= 0) return undefined;

  const day = new Date(`${yearEnd}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  day.setUTCMonth(day.getUTCMonth() + months);
  day.setUTCDate(day.getUTCDate() - 1);

  return day.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 2) / 2;
}
