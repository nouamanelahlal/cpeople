import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { addDays } from '@cpeople/shared';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday } from '../../common/time/clock.js';
import type { HireDto, HireOptionsDto, HiredDto } from './dto/hire.dto.js';

/** How far ahead someone may be hired: a start date, not a guess at one. */
const FURTHEST_START_DAYS = 90;

/**
 * Hiring somebody (HR-01 spec 6.4).
 *
 * One request creates the person, the contract they will sign and the list of
 * things that have to happen before they start. They are created together or not
 * at all: a person with no contract, or a contract with nobody to sign it, is
 * worse than a wizard that has to be filled in again.
 *
 * What the wizard offers comes from here too, so it can only offer positions,
 * sites, contract types and managers that actually exist in this tenant.
 */
@Injectable()
export class HireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  async options(): Promise<HireOptionsDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'employee.create')) {
      throw new ForbiddenException('People are hired by HR.');
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const [positions, sites, contractTypes, managers] = await Promise.all([
        tx.position.findMany({
          orderBy: { title: 'asc' },
          include: { department: { select: { code: true, name: true, site: { select: { code: true } } } } },
        }),
        tx.site.findMany({ orderBy: { name: 'asc' }, select: { code: true, name: true } }),
        tx.contractType.findMany({ orderBy: { name: 'asc' } }),
        // Anyone who already has people under them, plus the heads: the list a
        // new person's manager is picked from.
        tx.employee.findMany({
          where: { status: 'active', reports: { some: {} } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { code: true } },
          },
        }),
      ]);

      return {
        positions: positions.map((position) => ({
          code: position.code,
          title: position.title,
          department: position.department.name,
          departmentCode: position.department.code,
          ...(position.department.site ? { siteCode: position.department.site.code } : {}),
        })),
        sites,
        contractTypes: contractTypes.map((type) => ({
          code: type.code,
          name: type.name,
          requiresEndDate: type.requiresEndDate,
          ...(type.defaultTrialDays === null ? {} : { defaultTrialDays: type.defaultTrialDays }),
        })),
        managers: managers.map((manager) => ({
          id: manager.id,
          name: `${manager.firstName} ${manager.lastName}`,
          departmentCode: manager.department.code,
        })),
        today: demoToday(),
        nextEmployeeNumber: await nextNumber(tx),
      };
    });
  }

  async hire(body: HireDto): Promise<HiredDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'employee.create')) {
      throw new ForbiddenException('People are hired by HR.');
    }

    const today = demoToday();
    const hireDate = plainOrThrow(body.hireDate, 'hire date');
    const birthDate = plainOrThrow(body.birthDate, 'date of birth');

    if (hireDate > addDays(today, FURTHEST_START_DAYS)) {
      throw new BadRequestException('A start date more than 90 days away is probably a mistake.');
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const nationalId = body.nationalId.trim();

      if (nationalId === '') {
        throw new BadRequestException('A national identifier is required.');
      }

      // The identifier is one person's. The database says so too; this turns
      // that into an answer the wizard can act on.
      const clash = await tx.employee.findFirst({
        where: { nationalId },
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

      const position = await tx.position.findFirst({
        where: { code: body.positionCode.trim() },
        include: { department: true },
      });

      if (!position) {
        throw new BadRequestException('No such position.');
      }

      const contractType = await tx.contractType.findFirst({
        where: { code: body.contractTypeCode.trim() },
      });

      if (!contractType) {
        throw new BadRequestException('No such kind of contract.');
      }

      const endDate = body.contractEndDate?.trim() ? plainOrThrow(body.contractEndDate, 'end date') : null;

      if (contractType.requiresEndDate && endDate === null) {
        throw new BadRequestException(`${contractType.name} needs an end date.`);
      }

      if (endDate !== null && endDate <= hireDate) {
        throw new BadRequestException('A contract cannot end before it starts.');
      }

      // The site they will work at: the one chosen, or their department's own.
      const siteCode = body.siteCode?.trim();
      const site = siteCode
        ? await tx.site.findFirst({ where: { code: siteCode } })
        : position.department.siteId
          ? await tx.site.findUnique({ where: { id: position.department.siteId } })
          : null;

      const company = await tx.company.findFirstOrThrow({ select: { id: true } });
      const employeeNumber = await nextNumber(tx);

      const employee = await tx.employee.create({
        data: {
          tenantId: user.tenantId,
          companyId: company.id,
          employeeNumber,
          status: 'onboarding',
          firstName: body.firstName.trim().slice(0, 120),
          lastName: body.lastName.trim().slice(0, 120),
          gender: gender(body.gender),
          birthDate: date(birthDate),
          nationality: (body.nationality?.trim() || 'MA').slice(0, 2).toUpperCase(),
          nationalId,
          maritalStatus: marital(body.maritalStatus),
          ...(body.address?.trim() ? { address: body.address.trim().slice(0, 240) } : {}),
          ...(body.phone?.trim() ? { phone: body.phone.trim().slice(0, 40) } : {}),
          ...(body.email?.trim() ? { email: body.email.trim().slice(0, 160) } : {}),
          positionId: position.id,
          departmentId: position.departmentId,
          ...(site ? { siteId: site.id } : {}),
          ...(position.department.costCentreId
            ? { costCentreId: position.department.costCentreId }
            : {}),
          ...(body.managerId?.trim() ? { managerId: body.managerId.trim() } : {}),
          hireDate: date(hireDate),
          seniorityDate: date(hireDate),
          baseSalaryMinor: Math.max(0, Math.round(body.baseSalaryMinor)),
          salaryCurrency: 'MAD',
          ...(body.socialSecurityNumber?.trim()
            ? { socialSecurityNumber: body.socialSecurityNumber.trim().slice(0, 40) }
            : {}),
          pensionMember: body.pensionMember === true,
          ...(body.bankName?.trim() ? { bankName: body.bankName.trim().slice(0, 120) } : {}),
          ...(body.bankAccount?.trim() ? { bankAccount: body.bankAccount.trim().slice(0, 40) } : {}),
          ...(body.dependents && body.dependents.length > 0
            ? {
                dependents: {
                  create: body.dependents.slice(0, 12).map((dependent) => ({
                    tenantId: user.tenantId,
                    relation: dependent.relation === 'spouse' ? 'spouse' : 'child',
                    firstName: dependent.firstName.trim().slice(0, 120),
                    birthDate: date(plainOrThrow(dependent.birthDate, 'date of birth')),
                  })),
                },
              }
            : {}),
        },
      });

      const trialDays = contractType.defaultTrialDays ?? 45;
      const trialEnd = body.trialEndDate?.trim()
        ? plainOrThrow(body.trialEndDate, 'trial period end')
        : addDays(hireDate, trialDays);

      const contract = await tx.contract.create({
        data: {
          tenantId: user.tenantId,
          employeeId: employee.id,
          contractTypeId: contractType.id,
          status: 'draft',
          startDate: date(hireDate),
          ...(endDate ? { endDate: date(endDate) } : {}),
          trialEndDate: date(trialEnd),
          positionId: position.id,
          ...(site ? { workplaceSiteId: site.id } : {}),
          salaryMinor: Math.max(0, Math.round(body.baseSalaryMinor)),
          salaryCurrency: 'MAD',
        },
      });

      const tasks = await this.#checklist(tx, {
        tenantId: user.tenantId,
        employeeId: employee.id,
        departmentCode: position.department.code,
        hireDate,
      });

      await this.audit.record(tx, user, {
        action: 'employee.created',
        entity: 'employee',
        entityId: employee.id,
        summary: `${employee.firstName} ${employee.lastName}`,
        diff: [
          { field: 'employeeNumber', from: '', to: employeeNumber },
          { field: 'position', from: '', to: position.title },
          { field: 'hireDate', from: '', to: hireDate },
          { field: 'contract', from: '', to: contractType.code },
        ],
      });

      return {
        id: employee.id,
        employeeNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        tasks,
        contractId: contract.id,
      };
    });
  }

  /**
   * The things that have to happen before somebody starts.
   *
   * Taken from the checklist template, keeping the items that apply to the
   * department they are joining, with due dates counted from their first day —
   * some of them before it, which is the point of collecting papers early.
   */
  async #checklist(
    tx: TenantClient,
    person: { tenantId: string; employeeId: string; departmentCode: string; hireDate: string },
  ): Promise<number> {
    const template = await tx.checklistTemplate.findFirst({
      where: { code: 'NEW-HIRE' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!template) {
      return 0;
    }

    const items = template.items.filter(
      (item) =>
        item.departmentCodes.length === 0 || item.departmentCodes.includes(person.departmentCode),
    );

    await tx.onboardingTask.createMany({
      data: items.map((item) => ({
        tenantId: person.tenantId,
        employeeId: person.employeeId,
        templateId: template.id,
        itemTemplateId: item.id,
        title: item.title,
        ownerRole: item.ownerRole,
        dueDate: date(addDays(person.hireDate, item.dueOffsetDays)),
        mandatory: item.mandatory,
        sortOrder: item.sortOrder,
      })),
    });

    return items.length;
  }
}

/** The next number in this company's own series. */
async function nextNumber(tx: TenantClient): Promise<string> {
  const last = await tx.employee.findFirst({
    orderBy: { employeeNumber: 'desc' },
    select: { employeeNumber: true },
  });

  const digits = Number.parseInt(last?.employeeNumber.replace(/\D+/g, '') ?? '0', 10);
  const prefix = last?.employeeNumber.replace(/[\d].*$/, '') ?? 'SMG-';

  return `${prefix}${String((Number.isFinite(digits) ? digits : 0) + 1).padStart(4, '0')}`;
}

function plainOrThrow(value: string | undefined, what: string): string {
  const text = value?.trim() ?? '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BadRequestException(`A ${what} is required, as a date.`);
  }

  return text;
}

function date(plain: string): Date {
  return new Date(`${plain}T00:00:00Z`);
}

function gender(value: string | undefined): 'female' | 'male' | 'unspecified' {
  return value === 'female' || value === 'male' ? value : 'unspecified';
}

function marital(value: string | undefined): 'single' | 'married' | 'divorced' | 'widowed' {
  return value === 'married' || value === 'divorced' || value === 'widowed' ? value : 'single';
}
