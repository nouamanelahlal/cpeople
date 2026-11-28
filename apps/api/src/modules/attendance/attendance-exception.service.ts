import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { convertToRecovery, planUndo, recoveryBalance, restoreAfterUndo } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { plainDate } from '../../common/time/clock.js';
import { WorkDayBuilderService } from './workday-builder.service.js';

/**
 * What the device could not explain (M10 / HR-04, build spec §5.4).
 *
 * An exception is a question about one person on one day, and every one of them
 * is answered by a human with a reason. There is no "resolve all", and nothing
 * here guesses: a badge in with no badge out is not a forgotten eight-hour day,
 * and a number nobody has is not approximately somebody.
 *
 * Two rules run through every fix:
 *
 *  - **the reason is required**, and lands in the audit log with the name of
 *    whoever gave it. A worked day that was changed by hand has to be able to
 *    say who changed it and why, months later, to somebody disputing a payslip;
 *  - **a fixed day's source becomes `mixed`**, so a re-import leaves it alone.
 *    Somebody's afternoon, put right by hand, is not undone by tomorrow's file.
 */
export const RESOLUTIONS = [
  /** UNKNOWN_EMPLOYEE: this number is that person's. */
  'map',
  /** Any: it is not worth acting on, and here is why. */
  'ignore',
  /** MISSING_IN / MISSING_OUT: the punch the device did not get. */
  'addPunch',
  /** ABSENT_NO_LEAVE: there is no leave and there will not be; do not pay it. */
  'unpaidAbsence',
  /** WORKED_HOLIDAY / WORKED_REST_DAY: pay it at the rate the rules give. */
  'confirmOvertime',
  /** WORKED_HOLIDAY / WORKED_REST_DAY: owe it back as time instead. */
  'convertToRecovery',
  /** Undo the above, which is the one that needs care. */
  'undoRecovery',
  /** OVER_DAILY_MAX / OVER_WEEKLY_MAX and the rest: yes, that is right. */
  'confirm',
] as const;

export type Resolution = (typeof RESOLUTIONS)[number];

/** Which answers make sense for which question. */
const ALLOWED: Record<string, readonly Resolution[]> = {
  UNKNOWN_EMPLOYEE: ['map', 'ignore'],
  MISSING_IN: ['addPunch', 'ignore'],
  MISSING_OUT: ['addPunch', 'ignore'],
  DUPLICATE: ['confirm', 'ignore'],
  NO_SCHEDULE: ['confirm', 'ignore'],
  ABSENT_NO_LEAVE: ['unpaidAbsence', 'ignore'],
  WORKED_ON_LEAVE: ['confirm', 'ignore'],
  WORKED_REST_DAY: ['confirmOvertime', 'convertToRecovery', 'undoRecovery', 'ignore'],
  WORKED_HOLIDAY: ['confirmOvertime', 'convertToRecovery', 'undoRecovery', 'ignore'],
  OVER_DAILY_MAX: ['confirm', 'ignore'],
  OVER_WEEKLY_MAX: ['confirm', 'ignore'],
};

export interface ExceptionRow {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly detail?: string;
  readonly date?: string;
  readonly employee?: { id: string; name: string; employeeNumber: string; department?: string };
  readonly workedMin?: number;
  readonly overtimeMin?: number;
  readonly recoveryMin?: number;
  /** What may be done about it, which is the code's list minus what makes no sense here. */
  readonly resolutions: Resolution[];
  readonly resolution?: string;
  readonly comment?: string;
  readonly resolvedBy?: string;
  readonly resolvedAt?: string;
}

export interface ExceptionList {
  readonly groups: { code: string; open: number; resolved: number }[];
  readonly rows: ExceptionRow[];
  readonly departments: { id: string; name: string }[];
  readonly mayCorrect: boolean;
  readonly scope: 'all' | 'team';
  readonly total: number;
}

@Injectable()
export class AttendanceExceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly builder: WorkDayBuilderService,
  ) {}

  /**
   * The open questions, grouped by kind.
   *
   * A manager sees their own branch and nothing else — the same rule the
   * employee list follows, through the same helper, so the two cannot drift
   * apart. An exception with no day behind it (a number nobody has) belongs to
   * nobody, so only the people who see everybody see those.
   */
  async list(query: {
    code?: string;
    department?: string;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<ExceptionList> {
    const user = await this.#mayView();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const visible = await visibleEmployeeIds(tx, user);
      const everyone = visible === 'all';

      const dayWhere = {
        ...(everyone ? {} : { employeeId: { in: visible } }),
        ...(query.department ? { employee: { departmentId: query.department } } : {}),
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: date(query.from) } : {}),
                ...(query.to ? { lte: date(query.to) } : {}),
              },
            }
          : {}),
      };

      // An exception either hangs off a day — and is then the day's reader's
      // business — or off nothing, which only the whole company's reader sees.
      const where: Parameters<typeof tx.attendanceException.findMany>[0] extends
        | { where?: infer W }
        | undefined
        ? W
        : never = {
        ...(query.code ? { code: query.code } : {}),
        ...(query.status === 'open' || query.status === 'fixed' || query.status === 'ignored'
          ? { status: query.status }
          : {}),
        ...(everyone
          ? { OR: [{ workDay: dayWhere }, { workDayId: null }] }
          : { workDay: dayWhere }),
      };

      const [rows, grouped, departments] = await Promise.all([
        tx.attendanceException.findMany({
          where,
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          take: 300,
          select: {
            id: true,
            code: true,
            status: true,
            detail: true,
            resolution: true,
            comment: true,
            resolvedBy: true,
            resolvedAt: true,
            workDay: {
              select: {
                date: true,
                workedMin: true,
                overtime: true,
                recoveryMin: true,
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                    department: { select: { name: true } },
                  },
                },
              },
            },
          },
        }),
        tx.attendanceException.groupBy({
          by: ['code', 'status'],
          where: everyone ? {} : { workDay: dayWhere },
          _count: { _all: true },
        }),
        tx.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      ]);

      const groups = new Map<string, { code: string; open: number; resolved: number }>();

      for (const row of grouped) {
        const group = groups.get(row.code) ?? { code: row.code, open: 0, resolved: 0 };
        if (row.status === 'open') group.open += row._count._all;
        else group.resolved += row._count._all;
        groups.set(row.code, group);
      }

      return {
        groups: [...groups.values()].sort((a, b) => b.open - a.open || a.code.localeCompare(b.code)),
        rows: rows.map((row) => view(row)),
        departments,
        mayCorrect: this.users.may(user, 'attendance.correct'),
        scope: everyone ? ('all' as const) : ('team' as const),
        total: rows.length,
      };
    });
  }

  /**
   * Answering one.
   *
   * Every branch below writes an audit entry and leaves the day marked as
   * touched by hand. What differs is only what each answer means.
   */
  async resolve(
    id: string,
    body: {
      resolution?: string;
      comment?: string;
      employeeId?: string;
      at?: string;
      direction?: string;
      override?: boolean;
    },
  ): Promise<{ ok: true } | never> {
    const user = await this.#mayCorrect();

    const reason = (body.comment ?? '').trim();
    if (reason === '') {
      throw new BadRequestException({ kind: 'reasonRequired', values: {} });
    }

    const resolution = body.resolution as Resolution | undefined;
    if (!resolution || !RESOLUTIONS.includes(resolution)) {
      throw new BadRequestException({ kind: 'unknownResolution', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const exception = await tx.attendanceException.findFirst({
        where: { id },
        select: {
          id: true,
          code: true,
          status: true,
          detail: true,
          workDayId: true,
          workDay: {
            select: {
              id: true,
              date: true,
              employeeId: true,
              workedMin: true,
              overtime: true,
              premium: true,
              recoveryMin: true,
            },
          },
        },
      });

      if (exception === null) {
        throw new BadRequestException({ kind: 'exceptionGone', values: {} });
      }

      const allowed = ALLOWED[exception.code] ?? ['ignore'];
      if (!allowed.includes(resolution)) {
        throw new BadRequestException({ kind: 'wrongResolution', values: {} });
      }

      // A manager may only answer for their own branch.
      if (exception.workDay) {
        const visible = await visibleEmployeeIds(tx, user);
        if (visible !== 'all' && !visible.includes(exception.workDay.employeeId)) {
          throw new ForbiddenException({ kind: 'notYours', values: {} });
        }
      }

      switch (resolution) {
        case 'map':
          await this.#mapNumber(tx, user, exception.detail ?? '', body.employeeId, reason);
          break;

        case 'addPunch':
          await this.#addPunch(tx, user, exception, body, reason);
          break;

        case 'convertToRecovery':
          await this.#convert(tx, user, exception, reason);
          break;

        case 'undoRecovery':
          await this.#undo(tx, user, exception, reason, body.override === true);
          break;

        case 'unpaidAbsence':
          await this.#markUnpaid(tx, user, exception, reason);
          break;

        default:
          // confirm, confirmOvertime, ignore: the day is right as it stands and
          // somebody has said so. The record of that is the point.
          break;
      }

      await tx.attendanceException.update({
        where: { id },
        data: {
          status: resolution === 'ignore' ? ('ignored' as const) : ('fixed' as const),
          resolution,
          comment: reason,
          resolvedBy: user.name,
          resolvedAt: new Date(),
        },
      });

      if (exception.workDay) {
        await tx.workDay.update({
          where: { id: exception.workDay.id },
          data: { source: 'mixed', status: 'fixed' },
        });
      }

      await this.audit.record(tx, user, {
        action: 'attendance.exceptionResolved',
        entity: 'attendanceException',
        entityId: id,
        summary: `${exception.code} · ${resolution}`,
        diff: [
          { field: 'resolution', from: exception.status, to: resolution },
          { field: 'reason', from: '', to: reason },
        ],
      });

      return { ok: true as const };
    });
  }

  /** A number the device wrote, and the person it belongs to. */
  async #mapNumber(
    tx: TenantClient,
    user: CurrentUser,
    alias: string,
    employeeId: string | undefined,
    reason: string,
  ): Promise<void> {
    if (!employeeId || alias === '') {
      throw new BadRequestException({ kind: 'pickSomebody', values: {} });
    }

    await tx.employeeNumberAlias.create({
      data: { tenantId: user.tenantId, alias, employeeId, createdBy: user.name },
    });

    await this.audit.record(tx, user, {
      action: 'attendance.numberMapped',
      entity: 'employee',
      entityId: employeeId,
      summary: alias,
      diff: [
        { field: 'alias', from: '', to: alias },
        { field: 'reason', from: '', to: reason },
      ],
    });
  }

  /**
   * The punch the device did not get.
   *
   * Written as a punch like any other, marked `manual` and carrying its reason,
   * and then the day is rebuilt from all of them. It is not an adjustment to a
   * total: the day still comes from its punches, so it can be rebuilt again
   * later and still agree with itself.
   */
  async #addPunch(
    tx: TenantClient,
    user: CurrentUser,
    exception: { workDay: { id: string; date: Date; employeeId: string } | null },
    body: { at?: string; direction?: string },
    reason: string,
  ): Promise<void> {
    if (!exception.workDay || !body.at) {
      throw new BadRequestException({ kind: 'needATime', values: {} });
    }

    const day = plainDate(exception.workDay.date);
    const at = new Date(`${day}T${body.at.length === 5 ? `${body.at}:00` : body.at}.000Z`);

    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException({ kind: 'needATime', values: {} });
    }

    await tx.punch.create({
      data: {
        tenantId: user.tenantId,
        employeeId: exception.workDay.employeeId,
        employeeNumber: '',
        at,
        direction: body.direction === 'out' ? 'out' : 'in',
        source: 'manual',
        reason,
        createdBy: user.name,
      },
    });

    await this.#rebuild(tx, user, exception.workDay.id);
  }

  /** The day is settled in time instead of money. */
  async #convert(
    tx: TenantClient,
    user: CurrentUser,
    exception: {
      id: string;
      workDay: { id: string; employeeId: string; workedMin: number } | null;
    },
    reason: string,
  ): Promise<void> {
    if (!exception.workDay) {
      throw new BadRequestException({ kind: 'noDay', values: {} });
    }

    const settings = await tx.overtimeSettings.findFirst({ select: { recoveryRatio: true } });
    const ratio = Number(settings?.recoveryRatio ?? 1);

    const already = await tx.leaveRecoveryCredit.findFirst({
      where: { workDayId: exception.workDay.id },
      select: { id: true },
    });

    if (already) {
      throw new BadRequestException({ kind: 'alreadyRecovered', values: {} });
    }

    const converted = convertToRecovery({
      day: { workedMin: exception.workDay.workedMin, overtime: {} },
      ratio,
    });

    await tx.leaveRecoveryCredit.create({
      data: {
        tenantId: user.tenantId,
        employeeId: exception.workDay.employeeId,
        workDayId: exception.workDay.id,
        exceptionId: exception.id,
        minutes: converted.creditedMin,
        ratio,
        reason,
        createdBy: user.name,
      },
    });

    // The pay this replaces goes, or the hour is settled twice.
    await tx.workDay.update({
      where: { id: exception.workDay.id },
      data: {
        overtime: converted.overtime,
        premium: converted.premium,
        recoveryMin: converted.creditedMin,
      },
    });
  }

  /** Taking it back, which is the one that needs care. */
  async #undo(
    tx: TenantClient,
    user: CurrentUser,
    exception: {
      id: string;
      workDay: { id: string; employeeId: string; workedMin: number } | null;
    },
    reason: string,
    override: boolean,
  ): Promise<void> {
    if (!exception.workDay) {
      throw new BadRequestException({ kind: 'noDay', values: {} });
    }

    const credits = await tx.leaveRecoveryCredit.findMany({
      where: { employeeId: exception.workDay.employeeId },
      select: { id: true, minutes: true, ratio: true, workDayId: true },
    });

    const thisDay = credits.filter((row) => row.workDayId === exception.workDay?.id);
    const credited = thisDay.reduce((sum, row) => sum + row.minutes, 0);

    if (credited <= 0) {
      throw new BadRequestException({ kind: 'nothingToUndo', values: {} });
    }

    const plan = planUndo({
      creditedMin: credited,
      balanceMin: recoveryBalance(credits),
      workedMin: exception.workDay.workedMin,
      // The ratio it was earned at, not today's: the setting may have moved.
      ratio: Number(thisDay[0]?.ratio ?? 1),
      override,
    });

    if (plan.blocked) {
      throw new BadRequestException({
        kind: 'recoveryAlreadyUsed',
        values: { used: String(plan.usedMin) },
      });
    }

    await tx.leaveRecoveryCredit.create({
      data: {
        tenantId: user.tenantId,
        employeeId: exception.workDay.employeeId,
        workDayId: exception.workDay.id,
        exceptionId: exception.id,
        minutes: plan.movementMin,
        ratio: Number(thisDay[0]?.ratio ?? 1),
        reason,
        createdBy: user.name,
      },
    });

    // The day is rebuilt, so the pay comes from the punches and the rules in
    // force rather than from a number remembered from before.
    await tx.workDay.update({
      where: { id: exception.workDay.id },
      data: { recoveryMin: 0 },
    });

    await this.#rebuild(tx, user, exception.workDay.id, plan.restoredWorkedMin);
  }

  /** No leave, and none coming: the day is absence, and it is not paid. */
  async #markUnpaid(
    tx: TenantClient,
    user: CurrentUser,
    exception: { workDay: { id: string } | null },
    _reason: string,
  ): Promise<void> {
    if (!exception.workDay) return;

    await tx.workDay.update({
      where: { id: exception.workDay.id },
      data: { workedMin: 0, overtime: {}, premium: {} },
    });
  }

  /**
   * Builds a day again from its punches.
   *
   * `cap` is the one concession: after an undo, only the minutes not already
   * settled in time are worth money, so the restored overtime is worked out
   * from that much of the day rather than all of it.
   */
  async #rebuild(
    tx: TenantClient,
    user: CurrentUser,
    workDayId: string,
    cap?: number,
  ): Promise<void> {
    const day = await tx.workDay.findFirst({
      where: { id: workDayId },
      select: { id: true, date: true, employeeId: true, workedMin: true, scheduledMin: true },
    });

    if (!day) return;

    const on = plainDate(day.date);
    const context = await this.builder.context(tx, on);

    const punches = await tx.punch.findMany({
      where: {
        employeeId: day.employeeId,
        at: { gte: new Date(`${on}T00:00:00.000Z`), lt: new Date(`${on}T23:59:59.999Z`) },
        duplicate: false,
      },
      select: { at: true, direction: true },
      orderBy: { at: 'asc' },
    });

    const built = this.builder.build({
      employeeId: day.employeeId,
      date: on,
      punches: punches.map((p) => ({ at: p.at, direction: p.direction })),
      scheduled: day.scheduledMin > 0,
      restDay: false,
      context,
    });

    // After an undo, the pay covers only what was not already taken as time —
    // in whole minutes that add up to it exactly, rather than each band rounded
    // on its own and the total a minute out.
    const restored =
      cap === undefined
        ? { overtime: built.overtime, premium: built.premium }
        : restoreAfterUndo({
            overtime: built.overtime,
            premium: built.premium,
            restoredWorkedMin: cap,
            workedMin: built.workedMin,
          });

    await tx.workDay.update({
      where: { id: day.id },
      data: {
        workedMin: built.workedMin,
        overtime: restored.overtime,
        premium: restored.premium,
        overtimeRuleIds: built.overtimeRuleIds,
        calcVersion: built.calcVersion,
        builtAt: new Date(),
      },
    });

    await this.audit.record(tx, user, {
      action: 'attendance.dayRebuilt',
      entity: 'workDay',
      entityId: day.id,
      summary: on,
      diff: [{ field: 'workedMin', from: String(day.workedMin), to: String(built.workedMin) }],
    });
  }

  async #mayView(): Promise<CurrentUser> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'attendance.view')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return user;
  }

  async #mayCorrect(): Promise<CurrentUser> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'attendance.correct')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return user;
  }
}

/** One exception, as a screen needs it. */
function view(row: {
  id: string;
  code: string;
  status: string;
  detail: string | null;
  resolution: string | null;
  comment: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  workDay: {
    date: Date;
    workedMin: number;
    overtime: unknown;
    recoveryMin: number;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNumber: string;
      department: { name: string } | null;
    };
  } | null;
}): ExceptionRow {
  const overtime = row.workDay?.overtime as Record<string, number> | null;

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    ...(row.detail ? { detail: row.detail } : {}),
    ...(row.workDay
      ? {
          date: plainDate(row.workDay.date),
          workedMin: row.workDay.workedMin,
          overtimeMin: Object.values(overtime ?? {}).reduce((sum, value) => sum + value, 0),
          recoveryMin: row.workDay.recoveryMin,
          employee: {
            id: row.workDay.employee.id,
            name: `${row.workDay.employee.firstName} ${row.workDay.employee.lastName}`,
            employeeNumber: row.workDay.employee.employeeNumber,
            ...(row.workDay.employee.department
              ? { department: row.workDay.employee.department.name }
              : {}),
          },
        }
      : {}),
    resolutions: [...(ALLOWED[row.code] ?? ['ignore'])],
    ...(row.resolution ? { resolution: row.resolution } : {}),
    ...(row.comment ? { comment: row.comment } : {}),
    ...(row.resolvedBy ? { resolvedBy: row.resolvedBy } : {}),
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
  };
}

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
