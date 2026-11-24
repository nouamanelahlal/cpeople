import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LeaveRequestStatus, Prisma, TenantClient } from '@cpeople/db';
import {
  afterFirstApproval,
  approvalChain,
  awaiting,
  BLOCKING_STATUSES,
  isPending,
  MAX_SPAN_DAYS,
  spansClash,
  yearsOf,
  type DayPart,
} from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type {
  LeaveDecideDto,
  LeaveListDto,
  LeaveOptionDto,
  LeavePreviewDto,
  LeaveRequestCreateDto,
  LeaveRequestDetailDto,
  LeaveRequestDto,
  LeaveWarningDto,
} from './dto/leave-request.dto.js';
import { LeaveBalanceService } from './leave-balance.service.js';
import { date, LeaveCalendarService, type LeaveComputation } from './leave-calendar.service.js';
import { LeaveMailService } from './leave-mail.service.js';

/**
 * Asking for leave, and deciding it (M09 / HR-04).
 *
 * The three promises this service keeps, in the order they matter:
 *
 *  1. **What a request cost is recorded, not recomputed.** The count is worked
 *     out when it is sent and again when it is approved, and each answer is
 *     stored with the rule, the working week and the holidays behind it. After
 *     that nothing moves it except somebody accepting a change, which is a
 *     different act with its own audit entry.
 *  2. **Who approves comes from the organisation, and is fixed at the moment of
 *     asking.** N+1 is the manager, N+2 is their manager, and where there is
 *     nobody to ask — or the only person to ask is the requester — it goes to
 *     HR instead.
 *  3. **Warnings warn.** A thin balance, half a department away, short notice:
 *     all three are said out loud to the requester *and* the approver, and none
 *     of them refuses anything. What is refused is only what cannot be true: a
 *     span that runs backwards, a day already booked off, a half-day on a type
 *     taken in whole days.
 */
@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly calendar: LeaveCalendarService,
    private readonly balances: LeaveBalanceService,
    private readonly mail: LeaveMailService,
  ) {}

  /** The types somebody may ask for. */
  async options(): Promise<LeaveOptionDto[]> {
    const user = await this.users.withEmployee();
    this.#mustRequest(user);

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const types = await tx.leaveType.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      });

      return types.map((type) => ({
        id: type.id,
        code: type.code,
        name: type.name,
        allowsHalfDays: type.allowsHalfDays,
        requiresDocument: type.requiresDocument,
        dayBasis: type.dayBasis,
        requiresSecondApproval: type.requiresSecondApproval,
      }));
    });
  }

  /**
   * One tab of the leave screen.
   *
   * Each view is a different question, and each is answered by a different
   * permission — a manager asking for "all" gets their own team, because the
   * scope is applied here and not in the browser.
   */
  async list(view: string): Promise<LeaveListDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const tabs = this.#tabs(user);
      const asked = tabs.includes(view) ? view : (tabs[0] ?? 'mine');

      const [mine, approvals, all] = await Promise.all([
        user.employeeId
          ? tx.leaveRequest.findMany({
              where: { employeeId: user.employeeId },
              orderBy: { startDate: 'desc' },
              include: REQUEST_INCLUDE,
            })
          : Promise.resolve([]),
        this.#awaitingMe(tx, user),
        this.users.may(user, 'leave.manage.all')
          ? tx.leaveRequest.findMany({
              orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
              take: 200,
              include: REQUEST_INCLUDE,
            })
          : Promise.resolve([]),
      ]);

      const rows = asked === 'mine' ? mine : asked === 'approvals' ? approvals : all;
      const completeYears = await this.#completeYears(tx);

      return {
        requests: await Promise.all(
          rows.map((row) => this.#present(tx, user, row, completeYears)),
        ),
        review: [],
        counts: {
          mine: mine.length,
          approvals: approvals.length,
          all: all.length,
        },
        tabs,
        today,
        mayRequest: user.employeeId !== undefined && this.users.may(user, 'leave.request.own'),
      };
    });
  }

  /** What a request would cost, while somebody is still filling the form in. */
  async preview(dto: LeaveRequestCreateDto): Promise<LeavePreviewDto> {
    const user = await this.users.withEmployee();
    this.#mustRequest(user);

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const employeeId = await this.#targetEmployee(user, dto);
      const span = readSpan(dto);
      const problem = await this.#refusal(tx, { employeeId, leaveTypeId: dto.leaveTypeId, span });

      if (problem) {
        return {
          dayCount: 0,
          days: [],
          dayBasis: 'working' as const,
          warnings: [],
          blocked: problem,
        };
      }

      const computation = await this.calendar.compute(tx, {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        span,
      });

      return {
        dayCount: computation.dayCount,
        days: computation.days,
        dayBasis: computation.dayBasis,
        ...(computation.siteName ? { siteName: computation.siteName } : {}),
        warnings: await this.#warnings(tx, {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          span,
          computation,
          today: demoToday(),
        }),
      };
    });
  }

  /** Asking. */
  async submit(dto: LeaveRequestCreateDto): Promise<{ id: string }> {
    const user = await this.users.withEmployee();
    this.#mustRequest(user);

    const created = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const employeeId = await this.#targetEmployee(user, dto);
      const span = readSpan(dto);

      const problem = await this.#refusal(tx, { employeeId, leaveTypeId: dto.leaveTypeId, span });
      if (problem) {
        throw problem.kind === 'overlap'
          ? new ConflictException(problem)
          : new BadRequestException(problem);
      }

      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          managerId: true,
          manager: { select: { id: true, managerId: true } },
        },
      });

      const chain = approvalChain({
        requesterId: employee.id,
        managerId: employee.managerId,
        managerManagerId: employee.manager?.managerId,
      });

      const computation = await this.calendar.compute(tx, {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        span,
      });

      const request = await tx.leaveRequest.create({
        data: {
          tenantId: user.tenantId,
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          status: chain.status,
          startDate: date(span.from),
          endDate: date(span.to),
          startPart: span.firstDayPart ?? 'full',
          endPart: span.lastDayPart ?? 'full',
          ...(dto.reason?.trim() ? { reason: dto.reason.trim() } : {}),
          dayCount: computation.dayCount,
          ...(chain.n1Id ? { n1Id: chain.n1Id } : {}),
          ...(chain.n2Id ? { n2Id: chain.n2Id } : {}),
          toHr: chain.toHr,
        },
      });

      await this.#recordCalculation(tx, request.id, 'submitted', computation);

      await tx.leaveDecision.create({
        data: {
          tenantId: user.tenantId,
          requestId: request.id,
          kind: 'submitted',
          ...(user.employeeId ? { byEmployeeId: user.employeeId } : {}),
          byName: user.name,
          byRole: user.role,
        },
      });

      await this.audit.record(tx, user, {
        action: 'leave.request.submitted',
        entity: 'leaveRequest',
        entityId: request.id,
        summary: `${employee.firstName} ${employee.lastName}: ${span.from} → ${span.to}, ${computation.dayCount} days`,
      });

      return { id: request.id, employeeId, chain };
    });

    await this.#notifyApprover(user.tenantId, created.id);

    return { id: created.id };
  }

  /** One request, with everything behind it. */
  async detail(id: string): Promise<LeaveRequestDetailDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const request = await this.#readable(tx, user, id);
      const completeYears = await this.#completeYears(tx);
      const base = await this.#present(tx, user, request, completeYears);

      const [calculations, decisions, computation] = await Promise.all([
        tx.leaveCalculation.findMany({
          where: { requestId: id },
          orderBy: { createdAt: 'desc' },
        }),
        tx.leaveDecision.findMany({ where: { requestId: id }, orderBy: { at: 'asc' } }),
        this.calendar.compute(tx, {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          span: spanOf(request),
        }),
      ]);

      return {
        ...base,
        warnings: await this.#warnings(tx, {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          span: spanOf(request),
          computation,
          today,
          excludeRequestId: request.id,
          name: `${request.employee.firstName} ${request.employee.lastName}`,
          own: request.employeeId === user.employeeId,
        }),
        calculations: calculations.map((row) => ({
          id: row.id,
          kind: row.kind,
          dayCount: Number(row.dayCount),
          days: Array.isArray(row.days) ? (row.days as never[]) : [],
          dayBasis: row.dayBasis,
          workingDays: row.workingDays,
          ...(row.leaveRuleId ? { leaveRuleId: row.leaveRuleId } : {}),
          ...(row.workWeekId ? { workWeekId: row.workWeekId } : {}),
          holidayIds: row.holidayIds,
          holidaysComplete: row.holidaysComplete,
          ...(row.note ? { note: row.note } : {}),
          at: row.createdAt.toISOString(),
        })),
        decisions: decisions.map((row) => ({
          id: row.id,
          kind: row.kind,
          byName: row.byName,
          byRole: row.byRole,
          ...(row.reason ? { reason: row.reason } : {}),
          at: row.at.toISOString(),
        })),
        holidays: computation.holidays,
      };
    });
  }

  /**
   * Approving or refusing.
   *
   * Three people can get here: the approver the request is waiting on, HR when
   * it is HR's own queue, and HR stepping in over a line manager — which is an
   * override, always carries a reason, and is recorded as one.
   */
  async decide(id: string, dto: LeaveDecideDto): Promise<void> {
    const user = await this.users.withEmployee();

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id },
        include: REQUEST_INCLUDE,
      });

      if (!request) throw new NotFoundException('No such leave request.');

      const theirTurn = awaiting(
        { status: request.status, n1Id: request.n1Id, n2Id: request.n2Id },
        user.employeeId,
      );
      const hr = this.users.may(user, 'leave.manage.all');
      const hrQueue = hr && request.status === 'pending_hr';

      if (!theirTurn && !hrQueue && !hr) {
        throw new ForbiddenException({ kind: 'notYours', values: {} });
      }

      if (!isPending(request.status) && request.status !== 'cancellation_pending') {
        throw new ConflictException({ kind: 'notPending', values: {} });
      }

      // Stepping over the line manager is allowed, and never silently: HR says
      // why, and the request carries that sentence from then on.
      const override = !theirTurn && !hrQueue;
      const reason = dto.reason?.trim() ?? '';

      if ((override || dto.decision === 'reject') && reason === '') {
        throw new BadRequestException({ kind: 'reasonRequired', values: {} });
      }

      const cancelling = request.status === 'cancellation_pending';
      const approve = dto.decision === 'approve';

      const next = cancelling
        ? approve
          ? 'cancelled'
          : 'approved'
        : approve
          ? await this.#nextOnApproval(tx, request)
          : 'rejected';

      // The approval is the moment the count is fixed, so it is worked out again
      // here rather than trusted from when the request was sent: a holiday added
      // in between is part of what is being approved.
      let dayCount = Number(request.dayCount);

      if (!cancelling && approve && next === 'approved') {
        const computation = await this.calendar.compute(tx, {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          span: spanOf(request),
        });

        dayCount = computation.dayCount;
        await this.#recordCalculation(tx, request.id, 'approved', computation);
      }

      await tx.leaveRequest.update({
        where: { id },
        data: {
          status: next as LeaveRequestStatus,
          dayCount,
          ...(next === 'approved' || next === 'rejected' || next === 'cancelled'
            ? { decidedAt: new Date() }
            : {}),
          // Whatever was being flagged has now been seen by somebody who acted.
          recalculatedAt: null,
        },
      });

      await tx.leaveDecision.create({
        data: {
          tenantId: user.tenantId,
          requestId: id,
          kind: decisionKind({ cancelling, approve, override, status: request.status }),
          ...(user.employeeId ? { byEmployeeId: user.employeeId } : {}),
          byName: user.name,
          byRole: user.role,
          ...(reason ? { reason } : {}),
        },
      });

      await this.audit.record(tx, user, {
        action: `leave.request.${next}`,
        entity: 'leaveRequest',
        entityId: id,
        summary:
          `${request.employee.firstName} ${request.employee.lastName}: ` +
          `${plainDate(request.startDate)} → ${plainDate(request.endDate)}, ${dayCount} days` +
          (override ? ' (HR override)' : ''),
        ...(reason ? { diff: [{ field: 'reason', from: '', to: reason }] } : {}),
      });
    });

    await this.#notifyDecision(user.tenantId, id);
  }

  /** Taking a request back, before anybody has decided it. */
  async withdraw(id: string): Promise<void> {
    await this.#byRequester(id, {
      from: [...(['pending_n1', 'pending_n2', 'pending_hr'] as const)],
      to: 'withdrawn',
      kind: 'withdrawn',
      action: 'leave.request.withdrawn',
    });
  }

  /**
   * Asking to cancel leave that was already granted.
   *
   * It does not cancel it. The days are booked, a rota has been built around
   * them, and somebody has to agree — which is why this moves the request to a
   * state that is still blocking and still waiting on the approver.
   */
  async requestCancellation(id: string): Promise<void> {
    await this.#byRequester(id, {
      from: ['approved'],
      to: 'cancellation_pending',
      kind: 'cancellation_requested',
      action: 'leave.request.cancellation_requested',
    });

    const user = this.users.current();
    await this.#notifyApprover(user.tenantId, id, 'cancellationRequested');
  }

  // --- the parts the public methods are made of --------------------------

  #tabs(user: CurrentUser): string[] {
    const tabs: string[] = [];

    if (user.employeeId && this.users.may(user, 'leave.request.own')) tabs.push('mine');
    if (this.users.may(user, 'leave.approve')) tabs.push('approvals');

    // The month, for anybody with an employee file: an employee sees the team's
    // absences without being told what kind they are (HR-02 build spec §4.3).
    if (user.employeeId) tabs.push('calendar');

    if (this.users.may(user, 'leave.manage.all')) tabs.push('all', 'review');

    // Balances for other people, which is the employee list's scope: HR sees
    // the company, a manager sees their own branch of it, and anybody else sees
    // only their own — which is the card on their own tab, not a tab of its own.
    if (
      this.users.may(user, 'employee.list.all') ||
      this.users.may(user, 'employee.list.team')
    ) {
      tabs.push('balances');
    }

    return tabs;
  }

  #mustRequest(user: CurrentUser): void {
    if (!this.users.may(user, 'leave.request.own')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    if (user.employeeId === undefined) {
      throw new BadRequestException({ kind: 'noEmployee', values: {} });
    }
  }

  /** Whose leave this is. Only HR may ask on somebody else's behalf. */
  async #targetEmployee(user: CurrentUser, dto: LeaveRequestCreateDto): Promise<string> {
    if (!dto.employeeId || dto.employeeId === user.employeeId) {
      return user.employeeId as string;
    }

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return dto.employeeId;
  }

  /**
   * What would stop this request existing at all.
   *
   * Four things, and only four: a span that runs backwards or is absurdly long,
   * a type that is not in use, a half-day on a type taken whole, and days this
   * person already has booked off.
   */
  async #refusal(
    tx: TenantClient,
    input: {
      readonly employeeId: string;
      readonly leaveTypeId: string;
      readonly span: { from: string; to: string; firstDayPart?: DayPart; lastDayPart?: DayPart };
      readonly excludeRequestId?: string;
    },
  ): Promise<{ kind: string; values: Record<string, string> } | undefined> {
    const { span } = input;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(span.from) || !/^\d{4}-\d{2}-\d{2}$/.test(span.to)) {
      return { kind: 'span', values: {} };
    }

    if (span.to < span.from) {
      return { kind: 'span', values: {} };
    }

    const length = (Date.parse(span.to) - Date.parse(span.from)) / 86_400_000 + 1;
    if (length > MAX_SPAN_DAYS) {
      return { kind: 'tooLong', values: {} };
    }

    const type = await tx.leaveType.findUnique({ where: { id: input.leaveTypeId } });
    if (!type || !type.active) {
      return { kind: 'unknownType', values: {} };
    }

    const half = span.firstDayPart !== 'full' || span.lastDayPart !== 'full';
    if (half && !type.allowsHalfDays) {
      return { kind: 'halfDay', values: {} };
    }

    const today = demoToday();
    if (span.from < today) {
      const back = Math.round((Date.parse(today) - Date.parse(span.from)) / 86_400_000);
      const rule = await tx.leaveRule.findFirst({
        where: {
          leaveTypeId: input.leaveTypeId,
          effectiveFrom: { lte: date(span.from) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date(span.from) } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { maxBackdateDays: true },
      });

      const allowed = rule?.maxBackdateDays ?? 0;
      if (back > allowed) {
        return { kind: 'backdateTooFar', values: { days: String(allowed) } };
      }
    }

    const clash = await this.#clash(tx, input.employeeId, span, input.excludeRequestId);
    if (clash) {
      return { kind: 'overlap', values: { dates: clash } };
    }

    return undefined;
  }

  /** The dates this person already has booked off inside the span, if any. */
  async #clash(
    tx: TenantClient,
    employeeId: string,
    span: { from: string; to: string; firstDayPart?: DayPart; lastDayPart?: DayPart },
    excludeRequestId?: string,
  ): Promise<string | undefined> {
    const neighbours = await tx.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: [...BLOCKING_STATUSES] },
        startDate: { lte: date(span.to) },
        endDate: { gte: date(span.from) },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      select: { startDate: true, endDate: true, startPart: true, endPart: true },
    });

    const found = neighbours.find((other) =>
      spansClash(span, {
        from: plainDate(other.startDate),
        to: plainDate(other.endDate),
        firstDayPart: other.startPart,
        lastDayPart: other.endPart,
      }),
    );

    if (!found) return undefined;

    const from = plainDate(found.startDate);
    const to = plainDate(found.endDate);
    return from === to ? from : `${from} – ${to}`;
  }

  /**
   * Everything worth saying, none of it a refusal (HR-02 spec 2).
   *
   * The same list goes to the requester and to the approver, because a warning
   * only one of them can see is an argument waiting to happen.
   */
  async #warnings(
    tx: TenantClient,
    input: {
      readonly employeeId: string;
      readonly leaveTypeId: string;
      readonly span: { from: string; to: string };
      readonly computation: LeaveComputation;
      readonly today: string;
      readonly excludeRequestId?: string;
      readonly name?: string;
      readonly own?: boolean;
    },
  ): Promise<LeaveWarningDto[]> {
    const warnings: LeaveWarningDto[] = [];
    const { computation } = input;

    // 1. The holidays for a year the request touches are not finished, so the
    //    count may still move (HR-02 spec, point 3).
    for (const year of computation.unconfirmedYears) {
      warnings.push({ kind: 'holidays', values: { year: String(year) } });
    }

    // 2. More days than are left.
    const remaining = await this.balances.remaining(tx, {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      onDate: input.span.from,
    });

    if (remaining !== null && computation.dayCount > remaining) {
      warnings.push({
        kind: 'balance',
        values: {
          name: input.name ?? '',
          own: input.own ? 'true' : 'false',
          remaining: String(remaining),
          days: String(computation.dayCount),
        },
      });
    }

    // 3. Too much of one department away at once.
    const team = await this.#teamOff(tx, input);
    if (team) warnings.push(team);

    // 4. Shorter notice than the rule expects, and a start in the past.
    const notice = Math.round(
      (Date.parse(input.span.from) - Date.parse(input.today)) / 86_400_000,
    );

    if (computation.minNoticeDays > 0 && notice < computation.minNoticeDays) {
      warnings.push({
        kind: 'notice',
        values: { days: String(computation.minNoticeDays), given: String(Math.max(notice, 0)) },
      });
    }

    if (input.span.from < input.today) {
      warnings.push({ kind: 'backdate', values: {} });
    }

    return warnings;
  }

  /**
   * How much of a department is already away on one of these days.
   *
   * The threshold is a tenant setting, defaulting to a third, and it is a
   * warning for both the requester and the approver — never a refusal
   * (HR-02 open point 6).
   */
  async #teamOff(
    tx: TenantClient,
    input: {
      readonly employeeId: string;
      readonly span: { from: string; to: string };
      readonly excludeRequestId?: string;
    },
  ): Promise<LeaveWarningDto | undefined> {
    const employee = await tx.employee.findUnique({
      where: { id: input.employeeId },
      select: { departmentId: true, department: { select: { name: true } } },
    });

    if (!employee) return undefined;

    const settings = await tx.leaveSettings.findFirst({ select: { teamOffWarningPercent: true } });
    const threshold = settings?.teamOffWarningPercent ?? 33;

    const [size, away] = await Promise.all([
      tx.employee.count({ where: { departmentId: employee.departmentId, status: 'active' } }),
      tx.leaveRequest.findMany({
        where: {
          employeeId: { not: input.employeeId },
          employee: { departmentId: employee.departmentId },
          status: { in: [...BLOCKING_STATUSES] },
          startDate: { lte: date(input.span.to) },
          endDate: { gte: date(input.span.from) },
          ...(input.excludeRequestId ? { id: { not: input.excludeRequestId } } : {}),
        },
        select: { employeeId: true },
      }),
    ]);

    if (size === 0) return undefined;

    // The person asking counts too: "a third of the kitchen is off" has to
    // include the request being looked at.
    const people = new Set(away.map((row) => row.employeeId)).size + 1;
    const percent = Math.round((people / size) * 100);

    if (percent <= threshold) return undefined;

    return {
      kind: 'teamOff',
      values: {
        percent: String(percent),
        threshold: String(threshold),
        department: employee.department?.name ?? '',
      },
    };
  }

  async #nextOnApproval(
    tx: TenantClient,
    request: { status: LeaveRequestStatus; leaveTypeId: string; n2Id: string | null },
  ): Promise<LeaveRequestStatus> {
    if (request.status !== 'pending_n1') {
      return 'approved';
    }

    const type = await tx.leaveType.findUniqueOrThrow({
      where: { id: request.leaveTypeId },
      select: { requiresSecondApproval: true },
    });

    return afterFirstApproval({
      requiresSecondApproval: type.requiresSecondApproval,
      n2Id: request.n2Id,
    }) as LeaveRequestStatus;
  }

  async #recordCalculation(
    tx: TenantClient,
    requestId: string,
    kind: 'submitted' | 'approved' | 'recalculated' | 'accepted',
    computation: LeaveComputation,
    note?: string,
  ): Promise<void> {
    const tenantId = (await tx.leaveRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { tenantId: true },
    })).tenantId;

    await tx.leaveCalculation.create({
      data: {
        tenantId,
        requestId,
        kind,
        dayCount: computation.dayCount,
        days: computation.days.map((day) => ({ ...day })),
        ...(computation.leaveRuleId ? { leaveRuleId: computation.leaveRuleId } : {}),
        ...(computation.workWeekId ? { workWeekId: computation.workWeekId } : {}),
        holidayIds: computation.holidayIds,
        workingDays: computation.workingDays,
        dayBasis: computation.dayBasis,
        holidaysComplete: computation.holidaysComplete,
        ...(note ? { note } : {}),
      },
    });
  }

  async #awaitingMe(tx: TenantClient, user: CurrentUser): Promise<RequestRow[]> {
    if (!this.users.may(user, 'leave.approve')) return [];

    const mine = user.employeeId;
    const hr = this.users.may(user, 'leave.manage.all');

    return tx.leaveRequest.findMany({
      where: {
        OR: [
          ...(mine
            ? [
                { status: 'pending_n1' as const, n1Id: mine },
                { status: 'pending_n2' as const, n2Id: mine },
                { status: 'cancellation_pending' as const, n1Id: mine },
              ]
            : []),
          ...(hr ? [{ status: 'pending_hr' as const }] : []),
        ],
      },
      orderBy: { startDate: 'asc' },
      include: REQUEST_INCLUDE,
    });
  }

  async #readable(tx: TenantClient, user: CurrentUser, id: string): Promise<RequestRow> {
    const request = await tx.leaveRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!request) throw new NotFoundException('No such leave request.');

    if (this.users.may(user, 'leave.manage.all')) return request;

    const visible = await visibleEmployeeIds(tx, user);
    const allowed =
      visible === 'all' ||
      visible.includes(request.employeeId) ||
      request.n1Id === user.employeeId ||
      request.n2Id === user.employeeId;

    if (!allowed) throw new ForbiddenException({ kind: 'notYours', values: {} });

    return request;
  }

  /** The years whose public holidays somebody has marked finished. */
  async #completeYears(tx: TenantClient): Promise<Set<number>> {
    const rows = await tx.publicHolidayYear.findMany({
      where: { complete: true },
      select: { year: true },
    });

    return new Set(rows.map((row) => row.year));
  }

  /**
   * One request, as a reader sees it.
   *
   * The cheap warnings only: whether a year's holidays are still open, which is
   * one query for the whole list. The ones that cost a query each — the balance,
   * the department, the notice — are on the request's own page, where the person
   * deciding it is actually looking.
   */
  async #present(
    tx: TenantClient,
    user: CurrentUser,
    row: RequestRow,
    completeYears: Set<number>,
  ): Promise<LeaveRequestDto> {
    const own = row.employeeId === user.employeeId;
    const theirTurn = awaiting(
      { status: row.status, n1Id: row.n1Id, n2Id: row.n2Id },
      user.employeeId,
    );
    const hr = this.users.may(user, 'leave.manage.all');
    const pending = isPending(row.status) || row.status === 'cancellation_pending';

    const waiting = await this.#waitingOn(tx, row);
    const open = yearsOf({ from: plainDate(row.startDate), to: plainDate(row.endDate) }).filter(
      (year) => !completeYears.has(year),
    );

    const previous = row.recalculatedAt
      ? await tx.leaveCalculation.findFirst({
          where: { requestId: row.id, kind: { in: ['submitted', 'approved'] } },
          orderBy: { createdAt: 'desc' },
          select: { dayCount: true },
        })
      : null;

    return {
      id: row.id,
      status: row.status,
      employee: {
        id: row.employee.id,
        name: `${row.employee.firstName} ${row.employee.lastName}`,
        department: row.employee.department?.name ?? '',
      },
      leaveType: {
        id: row.leaveType.id,
        code: row.leaveType.code,
        name: row.leaveType.name,
        requiresDocument: row.leaveType.requiresDocument,
      },
      from: plainDate(row.startDate),
      to: plainDate(row.endDate),
      fromPart: row.startPart,
      toPart: row.endPart,
      dayCount: Number(row.dayCount),
      // The reason is the requester's own words, so it goes to them, to the
      // people deciding it, and to HR — and to nobody else.
      ...(row.reason && (own || theirTurn || hr) ? { reason: row.reason } : {}),
      ...(waiting ? { waitingOn: waiting } : {}),
      submittedAt: row.submittedAt.toISOString(),
      ...(row.decidedAt ? { decidedAt: row.decidedAt.toISOString() } : {}),
      ...(row.recalculatedAt ? { recalculatedAt: row.recalculatedAt.toISOString() } : {}),
      ...(previous ? { recalculatedFrom: Number(previous.dayCount) } : {}),
      mine: own,
      mayDecide: pending && (theirTurn || hr),
      wouldOverride: pending && !theirTurn && hr && row.status !== 'pending_hr',
      mayWithdraw: own && (isPending(row.status) || row.status === 'approved'),
      warnings: open.map((year) => ({ kind: 'holidays' as const, values: { year: String(year) } })),
    };
  }

  async #waitingOn(tx: TenantClient, row: RequestRow): Promise<{ id?: string; name: string } | undefined> {
    const id =
      row.status === 'pending_n1' || row.status === 'cancellation_pending'
        ? row.n1Id
        : row.status === 'pending_n2'
          ? row.n2Id
          : null;

    if (row.status === 'pending_hr') {
      return { name: 'HR' };
    }

    if (!id) return undefined;

    const person = await tx.employee.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true },
    });

    return person ? { id: person.id, name: `${person.firstName} ${person.lastName}` } : undefined;
  }

  /** Withdrawing and asking to cancel are the same shape, so they share this. */
  async #byRequester(
    id: string,
    move: {
      from: readonly LeaveRequestStatus[];
      to: LeaveRequestStatus;
      kind: 'withdrawn' | 'cancellation_requested';
      action: string;
    },
  ): Promise<void> {
    const user = await this.users.withEmployee();

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id },
        include: REQUEST_INCLUDE,
      });

      if (!request) throw new NotFoundException('No such leave request.');

      if (request.employeeId !== user.employeeId && !this.users.may(user, 'leave.manage.all')) {
        throw new ForbiddenException({ kind: 'notYours', values: {} });
      }

      if (!move.from.includes(request.status)) {
        throw new ConflictException({ kind: 'notPending', values: {} });
      }

      await tx.leaveRequest.update({
        where: { id },
        data: {
          status: move.to,
          ...(move.to === 'withdrawn' ? { decidedAt: new Date() } : {}),
        },
      });

      await tx.leaveDecision.create({
        data: {
          tenantId: user.tenantId,
          requestId: id,
          kind: move.kind,
          ...(user.employeeId ? { byEmployeeId: user.employeeId } : {}),
          byName: user.name,
          byRole: user.role,
        },
      });

      await this.audit.record(tx, user, {
        action: move.action,
        entity: 'leaveRequest',
        entityId: id,
        summary:
          `${request.employee.firstName} ${request.employee.lastName}: ` +
          `${plainDate(request.startDate)} → ${plainDate(request.endDate)}`,
      });
    });
  }

  // --- notices -----------------------------------------------------------

  /** Tells whoever the request is now waiting on. */
  async #notifyApprover(
    tenantId: string,
    id: string,
    kind: 'submitted' | 'cancellationRequested' = 'submitted',
  ): Promise<void> {
    const { recipient, facts } = await this.prisma.forTenant(tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: REQUEST_INCLUDE,
      });

      const approverId = request.status === 'pending_n2' ? request.n2Id : request.n1Id;

      const approver = approverId
        ? await tx.employee.findUnique({
            where: { id: approverId },
            select: { email: true, preferredLocale: true },
          })
        : null;

      const settings = await tx.leaveSettings.findFirst({ select: { hrEmail: true } });

      return {
        recipient:
          approver && request.status !== 'pending_hr'
            ? approver
            : { email: settings?.hrEmail, preferredLocale: null },
        facts: {
          name: `${request.employee.firstName} ${request.employee.lastName}`,
          from: plainDate(request.startDate),
          to: plainDate(request.endDate),
          days: Number(request.dayCount),
          tab: 'approvals' as const,
          requestId: request.id,
        },
      };
    });

    await this.mail.send(kind, recipient, facts);
  }

  /** Tells the requester what was decided, and the next approver if there is one. */
  async #notifyDecision(tenantId: string, id: string): Promise<void> {
    const work = await this.prisma.forTenant(tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: {
          ...REQUEST_INCLUDE,
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
        },
      });

      return {
        status: request.status,
        requester: { email: request.employee.email, preferredLocale: request.employee.preferredLocale },
        facts: {
          name: `${request.employee.firstName} ${request.employee.lastName}`,
          from: plainDate(request.startDate),
          to: plainDate(request.endDate),
          days: Number(request.dayCount),
          requestId: request.id,
        },
      };
    });

    if (work.status === 'pending_n2' || work.status === 'pending_hr') {
      await this.#notifyApprover(tenantId, id);
      return;
    }

    const kind =
      work.status === 'approved'
        ? 'approvedForYou'
        : work.status === 'cancelled'
          ? 'cancellationDecided'
          : 'rejectedForYou';

    await this.mail.send(kind, work.requester, { ...work.facts, tab: 'mine' });
  }
}

/** Everything a row needs to be drawn, in one include. */
const REQUEST_INCLUDE = {
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

type RequestRow = Prisma.LeaveRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

/** The span as the caller sent it, with the parts defaulted. */
function readSpan(dto: LeaveRequestCreateDto): {
  from: string;
  to: string;
  firstDayPart: DayPart;
  lastDayPart: DayPart;
} {
  return {
    from: String(dto.from ?? ''),
    to: String(dto.to ?? ''),
    firstDayPart: dto.fromPart ?? 'full',
    lastDayPart: dto.toPart ?? 'full',
  };
}

/** The span as it is stored. */
export function spanOf(request: {
  startDate: Date;
  endDate: Date;
  startPart: DayPart;
  endPart: DayPart;
}): { from: string; to: string; firstDayPart: DayPart; lastDayPart: DayPart } {
  return {
    from: plainDate(request.startDate),
    to: plainDate(request.endDate),
    firstDayPart: request.startPart,
    lastDayPart: request.endPart,
  };
}

function decisionKind(input: {
  cancelling: boolean;
  approve: boolean;
  override: boolean;
  status: LeaveRequestStatus;
}): 'approved_n1' | 'approved_n2' | 'rejected' | 'cancellation_approved' | 'cancellation_rejected' | 'hr_override' {
  if (input.override) return 'hr_override';

  if (input.cancelling) {
    return input.approve ? 'cancellation_approved' : 'cancellation_rejected';
  }

  if (!input.approve) return 'rejected';

  return input.status === 'pending_n2' ? 'approved_n2' : 'approved_n1';
}
