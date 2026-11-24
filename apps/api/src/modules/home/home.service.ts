import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import {
  employeeScope,
  visibleEmployeeIds,
} from '../../common/access/visible-employees.js';
import { expiringDocumentFilter, orNothing } from '../../common/documents/expiring.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantSettingsService } from '../../common/settings/tenant-settings.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type { HomeSummaryDto, HomeTaskDto } from './dto/home.dto.js';

/**
 * How far ahead the home screen looks for things about to happen.
 *
 * Documents are not in this list: how soon a document counts as running out
 * belongs to the kind of document, and the question is built per kind in
 * common/documents/expiring.ts — the same one the employee list's filter asks.
 */
const CONTRACT_WINDOW_DAYS = 30;
const WAITING_WINDOW_DAYS = 14;
const WAITING_LIMIT = 6;

/** A `where` on employees, built once from the role and passed around as one. */
type EmployeeFilter = NonNullable<Parameters<TenantClient['employee']['count']>[0]>['where'];

/**
 * The home screen's figures, counted over what the person asking may see
 * (HR-01 spec 6.12).
 *
 * Every count and every row comes from the same scope, so the number on a card
 * and the list it opens can never disagree — which is the acceptance criterion
 * the spec sets for them.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly settings: TenantSettingsService,
  ) {}

  async summary(): Promise<HomeSummaryDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const ids = await visibleEmployeeIds(tx, user);
      const scope = employeeScope(ids);
      // Everyone currently on the books: the people who have left are history.
      const employees: EmployeeFilter = { ...scope, status: { in: ['active', 'onboarding'] } };

      const [
        headcount,
        fixedTerm,
        joined,
        left,
        onboarding,
        documentsExpiring,
        contractsEnding,
        departments,
        holiday,
        onboardingOverdue,
      ] = await Promise.all([
        tx.employee.count({ where: employees }),
        tx.contract.count({
          where: {
            employee: employees,
            status: { in: ['signed', 'generated'] },
            endDate: { not: null },
          },
        }),
        tx.employee.count({
          // Joined, not due to join: someone starting next month has not arrived.
          where: { ...employees, hireDate: { gte: startOfMonth(today), lte: date(today) } },
        }),
        tx.employee.count({ where: { ...scope, leftOn: { gte: startOfMonth(today) } } }),
        tx.employee.count({ where: { ...scope, status: 'onboarding' } }),
        tx.employeeDocument.count({
          where: { employee: employees, ...orNothing(await expiringDocumentFilter(tx, today)) },
        }),
        tx.contract.count({
          where: {
            employee: employees,
            status: { in: ['signed', 'generated'] },
            endDate: { gte: date(today), lte: date(addDays(today, CONTRACT_WINDOW_DAYS)) },
          },
        }),
        this.#departments(tx, scope),
        tx.publicHoliday.findFirst({ where: { date: date(today) }, select: { name: true } }),
        tx.onboardingTask.count({
          where: { employee: employees, status: 'todo', dueDate: { lt: date(today) } },
        }),
      ]);

      return {
        today,
        ...(holiday ? { holiday: holiday.name } : {}),
        headcount: { value: headcount },
        fixedTerm,
        joinedThisMonth: joined,
        leftThisMonth: left,
        documentsExpiring: { value: documentsExpiring },
        onboarding,
        onboardingOverdue,
        contractsEnding,
        departments,
        waiting: await this.#waiting(tx, employees, today),
        away: await this.#away(tx, employees, today),
        leaveRequests: await this.#leaveRequests(tx, user),
        // The figure opens the list it counted, and that is a different list
        // for HR than for a manager.
        leaveRequestsTab: this.users.may(user, 'leave.manage.all') ? 'all' : 'approvals',
      };
    });
  }

  /**
   * Who is off this week (M09 / HR-04, build spec §4.3).
   *
   * Monday to Friday of the week containing today, with a count per day and the
   * people behind it — scoped like everything else, so a manager's week is
   * their own team's and HR's is the company's.
   *
   * Which **kind** of leave somebody is on is a separate question from whether
   * they are away, and it is answered by a setting: unless SMG has said
   * colleagues may see it, the type is simply not sent. "Nadia is off" is
   * roster information; "Nadia is on sick leave" is a medical detail.
   */
  async #away(
    tx: TenantClient,
    employees: EmployeeFilter,
    today: string,
  ): Promise<HomeSummaryDto['away']> {
    const monday = startOfWeek(today);
    const friday = addDays(monday, 4);

    const settings = await this.settings.read(tx);

    const [requests, holidays, workingToday] = await Promise.all([
      tx.leaveRequest.findMany({
        where: {
          employee: employees,
          status: { in: ['approved', 'cancellation_pending'] },
          startDate: { lte: date(friday) },
          endDate: { gte: date(monday) },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
          leaveType: { select: { code: true } },
          calculations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { startDate: 'asc' },
      }),
      tx.publicHoliday.findMany({
        where: { date: { gte: date(monday), lte: date(friday) } },
        select: { date: true, name: true },
      }),
      tx.employee.count({ where: employees }),
    ]);

    const holidayOn = new Map(holidays.map((row) => [plainDate(row.date), row.name]));

    // Who is away on which day, from the stored day detail where there is one:
    // a request that runs Monday to Friday does not make somebody away on a
    // Saturday they were never going to work.
    const onDay = new Map<string, Set<string>>();

    for (const request of requests) {
      const stored = request.calculations[0];
      const days = Array.isArray(stored?.days)
        ? (stored.days as unknown as { date: string; days: number }[])
        : [];

      for (let day = monday; day <= friday; day = addDays(day, 1)) {
        const inSpan =
          plainDate(request.startDate) <= day && day <= plainDate(request.endDate);
        if (!inSpan) continue;

        const counted = days.length === 0 || days.some((row) => row.date === day && row.days > 0);
        if (!counted) continue;

        const set = onDay.get(day) ?? new Set<string>();
        set.add(request.employeeId);
        onDay.set(day, set);
      }
    }

    const days = [];
    for (let day = monday; day <= friday; day = addDays(day, 1)) {
      const name = holidayOn.get(day);

      days.push({
        date: day,
        away: onDay.get(day)?.size ?? 0,
        holiday: name !== undefined,
        ...(name ? { holidayName: name } : {}),
      });
    }

    const seen = new Set<string>();
    const people = [];

    for (const request of requests) {
      if (seen.has(request.employeeId)) continue;
      seen.add(request.employeeId);

      people.push({
        id: request.employee.id,
        name: `${request.employee.firstName} ${request.employee.lastName}`,
        department: request.employee.department?.name ?? '',
        ...(settings.showLeaveTypeToColleagues ? { leaveTypeCode: request.leaveType.code } : {}),
        from: plainDate(request.startDate),
        to: plainDate(request.endDate),
      });
    }

    return {
      days,
      people,
      total: people.length,
      // Everybody, less whoever is off today, and nobody at all on a holiday.
      workingToday: holidayOn.has(today)
        ? 0
        : Math.max(workingToday - (onDay.get(today)?.size ?? 0), 0),
    };
  }

  /**
   * Leave requests waiting for this reader to do something.
   *
   * Their own inbox — the ones where they are the approver being waited on —
   * and for HR every request that is still pending, because an unanswered
   * request is HR's problem whoever it belongs to.
   */
  async #leaveRequests(tx: TenantClient, user: CurrentUser): Promise<number> {
    const hr = this.users.may(user, 'leave.manage.all');
    const mine = user.employeeId;

    if (hr) {
      return tx.leaveRequest.count({
        where: { status: { in: ['pending_n1', 'pending_n2', 'pending_hr'] } },
      });
    }

    if (!mine || !this.users.may(user, 'leave.approve')) return 0;

    return tx.leaveRequest.count({
      where: {
        OR: [
          { status: 'pending_n1', n1Id: mine },
          { status: 'pending_n2', n2Id: mine },
          { status: 'cancellation_pending', n1Id: mine },
        ],
      },
    });
  }

  async #departments(
    tx: TenantClient,
    scope: EmployeeFilter,
  ): Promise<HomeSummaryDto['departments']> {
    const departments = await tx.department.findMany({
      select: {
        code: true,
        name: true,
        _count: { select: { employees: true } },
        employees: { where: scope, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    return departments
      .map((department) => ({
        code: department.code,
        name: department.name,
        count: department.employees.length,
      }))
      .filter((department) => department.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * What is waiting, newest deadline first: a fixed term about to end, an
   * onboarding task past its date, a document that has already expired. Each one
   * carries the employee it belongs to, so the screen can open the real file.
   */
  async #waiting(tx: TenantClient, employees: EmployeeFilter, today: string): Promise<HomeTaskDto[]> {
    const [ending, overdue, expired] = await Promise.all([
      tx.contract.findMany({
        where: {
          employee: employees,
          status: { in: ['signed', 'generated'] },
          endDate: { gte: date(today), lte: date(addDays(today, WAITING_WINDOW_DAYS)) },
        },
        select: { endDate: true, employee: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { endDate: 'asc' },
        take: WAITING_LIMIT,
      }),
      tx.onboardingTask.findMany({
        where: { employee: employees, status: 'todo', dueDate: { lt: date(today) } },
        select: {
          title: true,
          dueDate: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: WAITING_LIMIT,
      }),
      tx.employeeDocument.findMany({
        where: { employee: employees, expiryDate: { lt: date(today) } },
        select: {
          expiryDate: true,
          documentType: { select: { name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { expiryDate: 'desc' },
        take: WAITING_LIMIT,
      }),
    ]);

    const items: HomeTaskDto[] = [
      ...ending.map((contract) => ({
        kind: 'contractEnding' as const,
        employeeId: contract.employee.id,
        employeeName: name(contract.employee),
        date: plainDate(contract.endDate!),
        days: daysBetween(today, plainDate(contract.endDate!)),
      })),
      ...overdue.map((task) => ({
        kind: 'onboardingOverdue' as const,
        employeeId: task.employee.id,
        employeeName: name(task.employee),
        date: plainDate(task.dueDate),
        detail: task.title,
        days: daysBetween(today, plainDate(task.dueDate)),
      })),
      ...expired.map((document) => ({
        kind: 'documentExpired' as const,
        employeeId: document.employee.id,
        employeeName: name(document.employee),
        date: plainDate(document.expiryDate!),
        detail: document.documentType.name,
        days: daysBetween(today, plainDate(document.expiryDate!)),
      })),
    ];

    // Soonest first, and the ones already past at the top of that.
    return items.sort((a, b) => (a.days ?? 0) - (b.days ?? 0)).slice(0, WAITING_LIMIT);
  }
}

function name(employee: { firstName: string; lastName: string }): string {
  return `${employee.firstName} ${employee.lastName}`;
}

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(iso: string, days: number): string {
  const value = date(iso);
  value.setUTCDate(value.getUTCDate() + days);
  return plainDate(value);
}

function startOfMonth(iso: string): Date {
  return date(`${iso.slice(0, 7)}-01`);
}

function daysBetween(from: string, to: string): number {
  return Math.round((date(to).getTime() - date(from).getTime()) / 86_400_000);
}

/**
 * The Monday of the week containing a day.
 *
 * The working week the home screen shows is Monday to Friday — the shape of the
 * card — and which days of it anybody actually works is the site's business,
 * answered by the leave calculation rather than here.
 */
function startOfWeek(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`);
  const weekday = day.getUTCDay();
  // Sunday counts as the end of the week before, not the start of this one.
  const back = weekday === 0 ? 6 : weekday - 1;

  return addDays(iso, -back);
}
