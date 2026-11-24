import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { SENSITIVE_FIELDS } from '@cpeople/shared';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { AuditService, type AuditDiffEntry } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantSettingsService } from '../../common/settings/tenant-settings.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type {
  AuditEventDto,
  ContractSummaryDto,
  EmployeeEditDto,
  EmployeeFileDto,
} from './dto/employee-file.dto.js';

/** The fields anyone with `employee.edit` may change on a file. */
const HR_EDITABLE = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'address',
  'maritalStatus',
  'nationalId',
  'baseSalaryMinor',
  'socialSecurityNumber',
  'pensionMember',
  'bankName',
  'bankAccount',
] as const;

/** What someone may correct on their own file, and nothing else (spec 5). */
const OWN_CONTACT = ['phone', 'email', 'address'] as const;

type Editable = (typeof HR_EDITABLE)[number];

/**
 * One employee's file: reading it, changing it, and the trail of both
 * (HR-01 spec 6.3 and 6.11).
 *
 * Two rules run through all of it. A file this reader may not see is not found,
 * rather than refused — the difference tells them whether the person exists. And
 * a field this reader may not see never leaves here, in the file, in a history
 * entry, or anywhere else: it is dropped from the answer rather than hidden on
 * the way past.
 */
@Injectable()
export class EmployeeFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly settings: TenantSettingsService,
  ) {}

  async file(id: string): Promise<EmployeeFileDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, id);

      const row = await tx.employee.findUnique({
        where: { id },
        include: {
          position: { select: { code: true, title: true } },
          department: { select: { code: true, name: true, costCentreId: true } },
          site: { select: { code: true, name: true } },
          costCentre: { select: { code: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          dependents: { orderBy: { birthDate: 'asc' } },
          contracts: {
            orderBy: { startDate: 'desc' },
            include: { contractType: { select: { code: true, name: true } } },
          },
          _count: { select: { documents: true } },
        },
      });

      if (!row) {
        throw new NotFoundException('No such employee file.');
      }

      const seeSensitive = this.users.maySeeSensitive(user, id);
      const ownFile = user.employeeId === id;

      // Pay is the one sensitive field with a setting of its own: an employee
      // reading their own file sees it only if SMG has switched it on, and when
      // it is off the figure is not sent at all (HR-01 open point 2). Everything
      // else sensitive follows the ordinary rule.
      const settings = await this.settings.read(tx);
      const seeSalary = seeSensitive && this.settings.maySeeSalary(user, id, settings);

      const contracts: ContractSummaryDto[] = row.contracts.map((contract) => ({
        id: contract.id,
        type: contract.contractType,
        status: contract.status,
        startDate: plainDate(contract.startDate),
        ...(contract.endDate ? { endDate: plainDate(contract.endDate) } : {}),
        ...(contract.trialEndDate ? { trialEndDate: plainDate(contract.trialEndDate) } : {}),
        // The money on a contract is the same secret as the money on the file.
        ...(seeSalary
          ? { salaryMinor: contract.salaryMinor, salaryCurrency: contract.salaryCurrency }
          : {}),
      }));

      return {
        id: row.id,
        employeeNumber: row.employeeNumber,
        status: row.status,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.gender,
        nationality: row.nationality,
        maritalStatus: row.maritalStatus,
        ...(row.phone ? { phone: row.phone } : {}),
        ...(row.email ? { email: row.email } : {}),
        position: { code: row.position.code, name: row.position.title },
        department: { code: row.department.code, name: row.department.name },
        ...(row.site ? { site: row.site } : {}),
        ...(row.costCentre ? { costCentre: row.costCentre } : {}),
        costCentreOverride: row.costCentreOverride,
        ...(row.manager
          ? {
              manager: {
                id: row.manager.id,
                name: `${row.manager.firstName} ${row.manager.lastName}`,
              },
            }
          : {}),
        hireDate: plainDate(row.hireDate),
        seniorityDate: plainDate(row.seniorityDate),
        seniorityMonths: monthsBetween(plainDate(row.seniorityDate), today),
        ...(row.leftOn ? { leftOn: plainDate(row.leftOn) } : {}),
        pensionMember: row.pensionMember,
        ...(seeSensitive
          ? {
              sensitive: {
                birthDate: plainDate(row.birthDate),
                nationalId: row.nationalId,
                ...(row.address ? { address: row.address } : {}),
                ...(seeSalary
                  ? { baseSalaryMinor: row.baseSalaryMinor, salaryCurrency: row.salaryCurrency }
                  : {}),
                ...(row.socialSecurityNumber
                  ? { socialSecurityNumber: row.socialSecurityNumber }
                  : {}),
                ...(row.bankName ? { bankName: row.bankName } : {}),
                ...(row.bankAccount ? { bankAccount: row.bankAccount } : {}),
                dependents: row.dependents.map((dependent) => ({
                  id: dependent.id,
                  relation: dependent.relation,
                  firstName: dependent.firstName,
                  birthDate: plainDate(dependent.birthDate),
                })),
              },
            }
          : {}),
        masked: seeSensitive
          ? seeSalary
            ? []
            : ['baseSalaryMinor', 'salary']
          : [...SENSITIVE_FIELDS],
        contracts,
        documentCount: row._count.documents,
        today,
        can: {
          edit: this.users.may(user, 'employee.edit'),
          editOwnContact: ownFile && this.users.may(user, 'employee.edit.own.contact'),
          seeSensitive,
          // Whoever may see the file may see what has been done to it.
          seeHistory: true,
        },
      };
    });
  }

  /**
   * Changes a file, and records what changed (HR-01 spec 6.3).
   *
   * Only the fields this person may change are read off the body; the rest are
   * ignored rather than refused, so naming a field is never a way to edit it.
   * Nothing is written unless something actually differs, and what is written to
   * the trail is the before and the after of each field, in one entry.
   */
  async edit(id: string, body: EmployeeEditDto): Promise<EmployeeFileDto> {
    const user = await this.users.withEmployee();
    const allowed = this.#editableBy(user, id);

    if (allowed.length === 0) {
      throw new ForbiddenException('This file is not yours to change.');
    }

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, id);

      const before = await tx.employee.findUnique({ where: { id } });
      if (!before) {
        throw new NotFoundException('No such employee file.');
      }

      const changes: Record<string, string | number | boolean | null> = {};
      const diff: AuditDiffEntry[] = [];

      for (const field of allowed) {
        const next = normalise(field, body[field]);
        if (next === undefined) continue;

        const current = before[field] ?? null;
        if (sameValue(current, next)) continue;

        changes[field] = next;
        diff.push({ field, from: asText(current), to: asText(next) });
      }

      if (diff.length === 0) {
        return;
      }

      // The national identifier is one person's: the database says so too, and
      // this turns that into an answer the screen can act on.
      if (typeof changes['nationalId'] === 'string') {
        const clash = await tx.employee.findFirst({
          where: { nationalId: changes['nationalId'], id: { not: id } },
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        });

        if (clash) {
          throw new ConflictException({
            message: 'Another employee already has that national identifier.',
            employee: {
              id: clash.id,
              name: `${clash.firstName} ${clash.lastName}`,
              employeeNumber: clash.employeeNumber,
            },
          });
        }
      }

      await tx.employee.update({ where: { id }, data: changes });
      await this.audit.record(tx, user, {
        action: 'employee.updated',
        entity: 'employee',
        entityId: id,
        summary: `${before.firstName} ${before.lastName}`,
        diff,
      });
    });

    return this.file(id);
  }

  /**
   * This file's history, newest first, masked for the reader (spec 6.3, 6.11).
   *
   * Anyone who may see a file may see what has been done to it: a manager who can
   * see their team's files can see that a salary was changed, by whom and when,
   * and not what it was changed to. The audit screen that spans the whole company
   * is a different thing, and that one is HR's and the administrator's.
   */
  async history(id: string): Promise<AuditEventDto[]> {
    const user = await this.users.withEmployee();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#mustSee(tx, user, id);

      const seeSensitive = this.users.maySeeSensitive(user, id);
      const events = await tx.auditEvent.findMany({
        where: { entity: 'employee', entityId: id },
        orderBy: { at: 'desc' },
        take: 100,
      });

      return events.map((event) => ({
        id: event.id,
        at: event.at.toISOString(),
        ...(event.actorName ? { actorName: event.actorName } : {}),
        ...(event.actorRole ? { actorRole: event.actorRole } : {}),
        action: event.action,
        summary: event.summary,
        diff: this.audit.readDiff(event.diff, { seeSensitive }),
      }));
    });
  }

  /** Which fields this person may change on this file, if any. */
  #editableBy(user: CurrentUser, id: string): readonly Editable[] {
    if (this.users.may(user, 'employee.edit')) {
      return HR_EDITABLE;
    }

    if (user.employeeId === id && this.users.may(user, 'employee.edit.own.contact')) {
      return OWN_CONTACT;
    }

    return [];
  }

  /**
   * A file outside this reader's scope is not found.
   *
   * "Forbidden" would answer the question they were not allowed to ask: whether
   * this person works here at all.
   */
  async #mustSee(tx: TenantClient, user: CurrentUser, id: string): Promise<void> {
    const ids = await visibleEmployeeIds(tx, user);

    if (ids !== 'all' && !ids.includes(id)) {
      throw new NotFoundException('No such employee file.');
    }
  }
}

/** The value as the column holds it, or undefined when nothing was sent. */
function normalise(field: Editable, value: unknown): string | number | boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (field === 'baseSalaryMinor') {
    const amount = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    // Money is integer minor units, and a salary is not negative (rule 4).
    return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : undefined;
  }

  if (field === 'pensionMember') {
    return value === true || value === 'true';
  }

  const text = String(value).trim();

  if (field === 'firstName' || field === 'lastName' || field === 'nationalId') {
    // The three a file cannot do without.
    return text === '' ? undefined : text.slice(0, 120);
  }

  return text === '' ? null : text.slice(0, 240);
}

function sameValue(current: unknown, next: unknown): boolean {
  return asText(current) === asText(next);
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return plainDate(value);
  return String(value);
}

/** Whole months from one plain date to another. */
function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number) as [number, number, number];
  const [toYear, toMonth, toDay] = to.split('-').map(Number) as [number, number, number];

  const months = (toYear - fromYear) * 12 + (toMonth - fromMonth) - (toDay < fromDay ? 1 : 0);
  return Math.max(0, months);
}
