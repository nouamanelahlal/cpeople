import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { isPending, PENDING_STATUSES } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type { LeaveReviewItemDto } from './dto/leave-request.dto.js';
import { leaveYear } from './leave-balance.service.js';
import { date, LeaveCalendarService, type LeaveComputation } from './leave-calendar.service.js';
import { LeaveCorrectionService } from './leave-correction.service.js';
import { LeaveMailService } from './leave-mail.service.js';
import { spanOf } from './leave-request.service.js';

/**
 * When the ground moves under a request (HR-02 spec, point 2).
 *
 * A public holiday is entered, a site starts trading on Saturdays, a rule is
 * given a new effective date — and requests that were counted under the old
 * settings now work out differently. Two kinds of request, two answers, and the
 * difference between them is the whole point:
 *
 *  - **Pending**: nobody has promised anything yet, so it is counted again at
 *    once, and the person who asked and the person deciding are both told.
 *  - **Approved**: a number was agreed, and somebody has built a rota on it. It
 *    stays exactly as agreed until HR looks at the difference and accepts it,
 *    which corrects the balance and leaves an audit entry behind.
 *
 * Nothing here runs on a schedule and nothing recalculates in the background.
 * The list is worked out when it is asked for, by counting each request again
 * and comparing it with what is on file — so it cannot drift out of date, and a
 * request can never change without a row saying who changed it.
 */
@Injectable()
export class LeaveReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly calendar: LeaveCalendarService,
    private readonly mail: LeaveMailService,
    private readonly corrections: LeaveCorrectionService,
  ) {}

  /**
   * What a settings change has moved.
   *
   * Two kinds of row, because there are two kinds of answer:
   *
   *  - an **approved** request whose count no longer matches the settings in
   *    force. Nothing has moved it; HR decides whether it should.
   *  - a **pending** request that was redone automatically. Nothing is being
   *    asked of HR here, but they are shown it anyway, because somebody has to
   *    be able to see what the change did. It leaves this list when the request
   *    is decided, which is what clears the notice on it.
   */
  async list(): Promise<LeaveReviewItemDto[]> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const differences = [...(await this.#differences(tx)), ...(await this.#redone(tx))];

      return differences.map((item) => ({
        request: {
          id: item.request.id,
          status: item.request.status,
          employee: {
            id: item.request.employee.id,
            name: `${item.request.employee.firstName} ${item.request.employee.lastName}`,
            department: item.request.employee.department?.name ?? '',
          },
          leaveType: {
            id: item.request.leaveType.id,
            code: item.request.leaveType.code,
            name: item.request.leaveType.name,
            requiresDocument: item.request.leaveType.requiresDocument,
          },
          from: plainDate(item.request.startDate),
          to: plainDate(item.request.endDate),
          fromPart: item.request.startPart,
          toPart: item.request.endPart,
          dayCount: Number(item.request.dayCount),
          submittedAt: item.request.submittedAt.toISOString(),
          ...(item.request.recalculatedAt
            ? { recalculatedAt: item.request.recalculatedAt.toISOString() }
            : {}),
          mine: item.request.employeeId === user.employeeId,
          mayDecide: false,
          wouldOverride: false,
          mayWithdraw: false,
          warnings: [],
        },
        agreed: item.agreed,
        now: item.now,
        because: item.because,
        pending: isPending(item.request.status),
      }));
    });
  }

  /**
   * HR agreeing that the new count is the right one.
   *
   * This is the only thing that moves an approved request's day count, and it
   * writes three rows: the new calculation, the decision on the request, and the
   * audit entry. The balance follows the day count, so accepting here is what
   * corrects it.
   */
  async accept(id: string): Promise<void> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id },
        include: REVIEW_INCLUDE,
      });

      if (!request) throw new NotFoundException('No such leave request.');

      const agreed = Number(request.dayCount);
      const computation = await this.calendar.compute(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        span: spanOf(request),
      });

      if (computation.dayCount === agreed) {
        throw new ConflictException({ kind: 'notPending', values: {} });
      }

      // What the request was last counted as, day by day: the evidence the
      // correction is measured against.
      const latest = await tx.leaveCalculation.findFirst({
        where: { requestId: id },
        orderBy: { createdAt: 'desc' },
        select: { days: true },
      });

      await this.#write(tx, user, request, computation, 'accepted');

      // Days that fall in a payroll month nobody may edit any more do not move
      // backwards: they are carried to the next open month as a correction
      // (HR-02 open point 13).
      await this.corrections.carry(tx, user, {
        requestId: id,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        before: Array.isArray(latest?.days) ? (latest.days as never[]) : [],
        after: computation.days,
        reason: `Accepted by HR after a settings change: ${agreed} → ${computation.dayCount} days.`,
      });

      await this.audit.record(tx, user, {
        action: 'leave.request.change_accepted',
        entity: 'leaveRequest',
        entityId: id,
        summary:
          `${request.employee.firstName} ${request.employee.lastName}: ` +
          `${agreed} → ${computation.dayCount} days after a settings change`,
        diff: [{ field: 'dayCount', from: String(agreed), to: String(computation.dayCount) }],
      });
    });
  }

  /**
   * Counts the pending requests again after a settings change.
   *
   * Called by the set-up screen once a holiday, a working week or a rule has
   * been saved. Approved requests are deliberately left alone: they appear on
   * the review list instead, and wait for a person.
   */
  async recalculatePending(user: CurrentUser): Promise<number> {
    const touched = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const differences = await this.#differences(tx, { pendingOnly: true });

      for (const item of differences) {
        await this.#write(tx, user, item.request, item.computation, 'recalculated');

        await this.audit.record(tx, user, {
          action: 'leave.request.recalculated',
          entity: 'leaveRequest',
          entityId: item.request.id,
          summary:
            `${item.request.employee.firstName} ${item.request.employee.lastName}: ` +
            `${item.agreed} → ${item.now} days after a settings change`,
          diff: [{ field: 'dayCount', from: String(item.agreed), to: String(item.now) }],
        });
      }

      return differences.map((item) => ({
        id: item.request.id,
        name: `${item.request.employee.firstName} ${item.request.employee.lastName}`,
        from: plainDate(item.request.startDate),
        to: plainDate(item.request.endDate),
        days: item.now,
        requester: {
          email: item.request.employee.email,
          preferredLocale: item.request.employee.preferredLocale,
        },
        approverId: item.request.status === 'pending_n2' ? item.request.n2Id : item.request.n1Id,
      }));
    });

    // The people affected are told outside the transaction: a mail relay having
    // a bad morning must not roll back a correction that is already true.
    for (const row of touched) {
      const facts = {
        name: row.name,
        from: row.from,
        to: row.to,
        days: row.days,
        requestId: row.id,
      };

      await this.mail.send('recalculated', row.requester, { ...facts, tab: 'mine' });

      if (row.approverId) {
        const approver = await this.prisma.forTenant(user.tenantId, (tx) =>
          tx.employee.findUnique({
            where: { id: row.approverId as string },
            select: { email: true, preferredLocale: true },
          }),
        );

        if (approver) {
          await this.mail.send('recalculated', approver, { ...facts, tab: 'approvals' });
        }
      }
    }

    return touched.length;
  }

  /**
   * The pending requests that were redone, and what they were before.
   *
   * "Before" is read off the calculation that preceded the correction, not
   * guessed: every count this system has ever made of a request is on file, so
   * the difference can be shown exactly rather than approximately.
   */
  async #redone(tx: TenantClient): Promise<Difference[]> {
    const rows = await tx.leaveRequest.findMany({
      where: { recalculatedAt: { not: null }, status: { in: [...PENDING_STATUSES] } },
      orderBy: { startDate: 'asc' },
      include: REVIEW_INCLUDE,
      take: 200,
    });

    const found = [];

    for (const request of rows) {
      const history = await tx.leaveCalculation.findMany({
        where: { requestId: request.id },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });

      const latest = history[0];
      const before = history[1];
      if (!latest) continue;

      found.push({
        request,
        agreed: Number(before?.dayCount ?? request.dayCount),
        now: Number(latest.dayCount),
        because: changed(before, latest),
      });
    }

    return found;
  }

  // --- the work --------------------------------------------------------

  /**
   * Every request whose count has moved, with the reason as far as the stored
   * evidence can tell it.
   */
  async #differences(
    tx: TenantClient,
    options: { pendingOnly?: boolean } = {},
  ): Promise<Required<Difference>[]> {
    const today = demoToday();
    const settings = await tx.leaveSettings.findFirst({ select: { leaveYearStart: true } });
    const year = leaveYear(today, settings?.leaveYearStart ?? '01-01');

    const candidates = await tx.leaveRequest.findMany({
      where: options.pendingOnly
        ? { status: { in: [...PENDING_STATUSES] } }
        : {
            OR: [
              { status: { in: [...PENDING_STATUSES] } },
              // An approved request from this leave year onwards: a change to
              // last year's calendar is history, not a correction.
              { status: 'approved', endDate: { gte: date(year.from) } },
            ],
          },
      orderBy: { startDate: 'asc' },
      include: REVIEW_INCLUDE,
      take: 500,
    });

    const found = [];

    for (const request of candidates) {
      const computation = await this.calendar.compute(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        span: spanOf(request),
      });

      const agreed = Number(request.dayCount);
      if (computation.dayCount === agreed) continue;

      const latest = await tx.leaveCalculation.findFirst({
        where: { requestId: request.id },
        orderBy: { createdAt: 'desc' },
      });

      found.push({
        request,
        agreed,
        now: computation.dayCount,
        because: changed(latest, {
          holidayIds: computation.holidayIds,
          workWeekId: computation.workWeekId ?? null,
          leaveRuleId: computation.leaveRuleId ?? null,
        }),
        computation,
      });
    }

    return found;
  }

  /** One correction: the calculation, the day count, the decision on the request. */
  async #write(
    tx: TenantClient,
    user: CurrentUser,
    request: ReviewRow,
    computation: LeaveComputation,
    kind: 'recalculated' | 'accepted',
  ): Promise<void> {
    await tx.leaveCalculation.create({
      data: {
        tenantId: user.tenantId,
        requestId: request.id,
        kind,
        dayCount: computation.dayCount,
        days: computation.days.map((day) => ({ ...day })),
        ...(computation.leaveRuleId ? { leaveRuleId: computation.leaveRuleId } : {}),
        ...(computation.workWeekId ? { workWeekId: computation.workWeekId } : {}),
        holidayIds: computation.holidayIds,
        workingDays: computation.workingDays,
        dayBasis: computation.dayBasis,
        holidaysComplete: computation.holidaysComplete,
        note: `Was ${Number(request.dayCount)} days.`,
      },
    });

    await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        dayCount: computation.dayCount,
        // Only a pending request wears the notice: an approved one that HR has
        // accepted is settled, and nobody needs to be nudged about it.
        recalculatedAt: kind === 'recalculated' ? new Date() : null,
      },
    });

    await tx.leaveDecision.create({
      data: {
        tenantId: user.tenantId,
        requestId: request.id,
        kind: kind === 'recalculated' ? 'recalculated' : 'change_accepted',
        ...(user.employeeId ? { byEmployeeId: user.employeeId } : {}),
        byName: user.name,
        byRole: user.role,
        reason: `${Number(request.dayCount)} → ${computation.dayCount} days`,
      },
    });
  }
}

/** One request whose count has moved, and what moved it. */
interface Difference {
  readonly request: ReviewRow;
  /** What is on file. */
  readonly agreed: number;
  /** What the settings in force work out as. */
  readonly now: number;
  readonly because: 'holidays' | 'week' | 'rule' | 'unknown';
  /** Present when the difference was found by counting again, not by reading history. */
  readonly computation?: LeaveComputation;
}

/** What a calculation applied, in the only three forms that can move a count. */
interface Evidence {
  readonly holidayIds: readonly string[];
  readonly workWeekId: string | null;
  readonly leaveRuleId: string | null;
}

/**
 * What changed, read off the stored evidence.
 *
 * Not a guess: a calculation kept the exact holiday rows, the working week row
 * and the rule row it used, so a difference in any of them is a fact. "Unknown"
 * is honest for the case where none of the three moved and the count still did —
 * which should not happen, and is worth saying rather than inventing a cause for.
 */
function changed(before: Evidence | null | undefined, after: Evidence): Difference['because'] {
  if (!before) return 'unknown';

  const was = [...before.holidayIds].sort().join(',');
  const now = [...after.holidayIds].sort().join(',');

  if (was !== now) return 'holidays';
  if (before.workWeekId !== after.workWeekId) return 'week';
  if (before.leaveRuleId !== after.leaveRuleId) return 'rule';

  return 'unknown';
}

const REVIEW_INCLUDE = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      preferredLocale: true,
      department: { select: { name: true } },
    },
  },
  leaveType: { select: { id: true, code: true, name: true, requiresDocument: true } },
} as const;

type ReviewRow = Awaited<ReturnType<TenantClient['leaveRequest']['findUniqueOrThrow']>> & {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    preferredLocale: string;
    department: { name: string } | null;
  };
  leaveType: { id: string; code: string; name: string; requiresDocument: boolean };
};
