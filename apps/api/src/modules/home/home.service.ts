import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import {
  employeeScope,
  visibleEmployeeIds,
} from '../../common/access/visible-employees.js';
import { expiringDocumentFilter, orNothing } from '../../common/documents/expiring.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
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
      };
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
