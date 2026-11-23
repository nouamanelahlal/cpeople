import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { daysUntil } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type { OnboardingDto } from './dto/onboarding.dto.js';

/**
 * What has to happen before somebody starts (HR-01 spec 6.8).
 *
 * The list is made when they are hired and ticked off by the people it names:
 * HR collects the papers, their manager does the induction, an administrator
 * makes their account. Ticking records who did it and when, because "it was
 * done" and "somebody says it was done" are different claims.
 *
 * When everything that must happen has happened, the file can be made active —
 * which is the moment a new hire stops being a plan and becomes an employee.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  async list(employeeId: string): Promise<OnboardingDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, employeeId);

      const [employee, tasks] = await Promise.all([
        tx.employee.findUniqueOrThrow({
          where: { id: employeeId },
          select: { status: true, hireDate: true, firstName: true, lastName: true },
        }),
        tx.onboardingTask.findMany({
          where: { employeeId },
          orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
        }),
      ]);

      const mine = (ownerRole: string): boolean =>
        user.role === 'admin' ||
        user.role === ownerRole ||
        // HR runs onboarding, whoever an item names as its owner.
        (user.role === 'hr' && this.users.may(user, 'onboarding.manage.all'));

      const outstanding = tasks.filter((task) => task.mandatory && task.status === 'todo');

      return {
        status: employee.status,
        hireDate: plainDate(employee.hireDate),
        today,
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          ownerRole: task.ownerRole,
          dueDate: plainDate(task.dueDate),
          daysLeft: daysUntil(plainDate(task.dueDate), today),
          status: task.status,
          mandatory: task.mandatory,
          ...(task.doneAt ? { doneAt: task.doneAt.toISOString() } : {}),
          ...(task.doneBy ? { doneBy: task.doneBy } : {}),
          mayTick: task.status === 'todo' && mine(task.ownerRole),
        })),
        done: tasks.filter((task) => task.status === 'done').length,
        total: tasks.length,
        // Only when there is a list, everything on it that matters is done, and
        // they are not already working here.
        mayActivate:
          tasks.length > 0 &&
          outstanding.length === 0 &&
          employee.status === 'onboarding' &&
          this.users.may(user, 'employee.edit'),
      };
    });
  }

  /** Ticks one item off, in the name of whoever ticked it. */
  async tick(employeeId: string, taskId: string): Promise<OnboardingDto> {
    const user = await this.users.withEmployee();

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, employeeId);

      const task = await tx.onboardingTask.findFirst({
        where: { id: taskId, employeeId },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });

      if (!task) {
        throw new NotFoundException('No such task.');
      }

      const mayTick =
        user.role === 'admin' ||
        user.role === task.ownerRole ||
        this.users.may(user, 'onboarding.manage.all') ||
        (this.users.may(user, 'onboarding.manage.team') && task.ownerRole === 'manager');

      if (!mayTick) {
        throw new ForbiddenException('That task belongs to somebody else.');
      }

      if (task.status === 'done') {
        return;
      }

      await tx.onboardingTask.update({
        where: { id: taskId },
        data: { status: 'done', doneAt: new Date(), doneBy: user.name },
      });

      await this.audit.record(tx, user, {
        action: 'onboarding.taskDone',
        entity: 'employee',
        entityId: employeeId,
        summary: `${task.employee.firstName} ${task.employee.lastName}`,
        diff: [{ field: 'task', from: task.title, to: 'done' }],
      });
    });

    return this.list(employeeId);
  }

  /**
   * Makes a new hire an employee.
   *
   * Refused while anything that must happen has not: the point of the list is
   * that somebody cannot quietly start without a contract or a medical
   * certificate.
   */
  async activate(employeeId: string): Promise<OnboardingDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'employee.edit')) {
      throw new ForbiddenException('A file is made active by HR.');
    }

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, employeeId);

      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: { status: true, firstName: true, lastName: true },
      });

      if (employee.status !== 'onboarding') {
        throw new BadRequestException('This file is not being onboarded.');
      }

      const outstanding = await tx.onboardingTask.count({
        where: { employeeId, mandatory: true, status: 'todo' },
      });

      if (outstanding > 0) {
        throw new BadRequestException(
          `${outstanding} things still have to happen before this file can be made active.`,
        );
      }

      await tx.employee.update({ where: { id: employeeId }, data: { status: 'active' } });
      await this.audit.record(tx, user, {
        action: 'employee.updated',
        entity: 'employee',
        entityId: employeeId,
        summary: `${employee.firstName} ${employee.lastName}`,
        diff: [{ field: 'status', from: 'onboarding', to: 'active' }],
      });
    });

    return this.list(employeeId);
  }

  async #mustSee(tx: TenantClient, user: CurrentUser, employeeId: string): Promise<void> {
    const ids = await visibleEmployeeIds(tx, user);

    if (ids !== 'all' && !ids.includes(employeeId)) {
      throw new NotFoundException('No such employee file.');
    }
  }
}
