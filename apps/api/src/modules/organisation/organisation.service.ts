import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { AuditService, type AuditDiffEntry } from '../../common/audit/audit.service.js';
import type { EmployeeStatus } from '@cpeople/db';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CompanyDto } from './dto/company.dto.js';
import type {
  DepartmentChangedDto,
  DepartmentEditDto,
  OrganisationDto,
} from './dto/organisation.dto.js';

/** People who are on the books: the ones a headcount is about. */
const ON_THE_BOOKS = { status: { in: ['active', 'onboarding'] as EmployeeStatus[] } };

/**
 * How this company is arranged (HR-01 spec 6.5).
 *
 * Departments, the positions in them, and the cost centres they cost against.
 * The last of those is the one the workshop is really about: payroll is posted
 * to SAP by cost centre, so a department pointing at the wrong one is a payroll
 * posted to the wrong place, and the mapping is therefore shown as its own view
 * with its gaps marked.
 */
@Injectable()
export class OrganisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  /** Companies of the current tenant (M01). The policies, not this query, filter. */
  async listCompanies(): Promise<CompanyDto[]> {
    const companies = await this.prisma.forCurrentTenant((tx) =>
      tx.company.findMany({ orderBy: { name: 'asc' } }),
    );

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      defaultCurrency: company.defaultCurrency,
    }));
  }

  async read(): Promise<OrganisationDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'settings.view')) {
      throw new ForbiddenException('The organisation is set up by HR and administrators.');
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const [departments, positions, costCentres, sites] = await Promise.all([
        tx.department.findMany({
          orderBy: { name: 'asc' },
          include: {
            site: true,
            costCentre: true,
            head: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        tx.position.findMany({
          orderBy: { code: 'asc' },
          include: {
            department: { select: { name: true } },
            reportsTo: { select: { title: true } },
            _count: { select: { employees: true } },
          },
        }),
        tx.costCentre.findMany({ orderBy: { code: 'asc' } }),
        tx.site.findMany({ orderBy: { name: 'asc' } }),
      ]);

      const headcounts = await Promise.all(
        departments.map((department) =>
          tx.employee.count({ where: { departmentId: department.id, ...ON_THE_BOOKS } }),
        ),
      );
      const overrides = await Promise.all(
        departments.map((department) =>
          tx.employee.count({
            where: { departmentId: department.id, costCentreOverride: true, ...ON_THE_BOOKS },
          }),
        ),
      );
      const centreUse = await Promise.all(
        costCentres.map(async (centre) => ({
          departmentCount: await tx.department.count({ where: { costCentreId: centre.id } }),
          employeeCount: await tx.employee.count({
            where: { costCentreId: centre.id, ...ON_THE_BOOKS },
          }),
        })),
      );

      return {
        departments: departments.map((department, index) => ({
          id: department.id,
          code: department.code,
          name: department.name,
          ...(department.site
            ? {
                site: {
                  id: department.site.id,
                  code: department.site.code,
                  name: department.site.name,
                  ...(department.site.city ? { city: department.site.city } : {}),
                },
              }
            : {}),
          ...(department.costCentre
            ? {
                costCentre: {
                  id: department.costCentre.id,
                  code: department.costCentre.code,
                  name: department.costCentre.name,
                  ...(department.costCentre.sapCostCentre
                    ? { sapCostCentre: department.costCentre.sapCostCentre }
                    : {}),
                  departmentCount: 0,
                  employeeCount: 0,
                },
              }
            : {}),
          ...(department.head
            ? {
                head: {
                  id: department.head.id,
                  name: `${department.head.firstName} ${department.head.lastName}`,
                },
              }
            : {}),
          headcount: headcounts[index] ?? 0,
          overrides: overrides[index] ?? 0,
        })),
        positions: positions.map((position) => ({
          id: position.id,
          code: position.code,
          title: position.title,
          department: position.department.name,
          ...(position.reportsTo ? { reportsTo: position.reportsTo.title } : {}),
          ...(position.plannedHeadcount === null
            ? {}
            : { plannedHeadcount: position.plannedHeadcount }),
          filled: position._count.employees,
        })),
        costCentres: costCentres.map((centre, index) => ({
          id: centre.id,
          code: centre.code,
          name: centre.name,
          ...(centre.sapCostCentre ? { sapCostCentre: centre.sapCostCentre } : {}),
          departmentCount: centreUse[index]?.departmentCount ?? 0,
          employeeCount: centreUse[index]?.employeeCount ?? 0,
        })),
        sites: sites.map((site) => ({
          id: site.id,
          code: site.code,
          name: site.name,
          ...(site.city ? { city: site.city } : {}),
        })),
        mayManage: this.users.may(user, 'organisation.manage'),
      };
    });
  }

  /**
   * Changes one department (HR-01 spec 6.5).
   *
   * The cost centre is the interesting one: moving a department's cost centre
   * does not move its people unless it is asked to, and even then only the ones
   * who do not have a cost centre of their own. Someone put there deliberately
   * stays there, and the count of who followed comes back so the screen can say
   * what happened.
   */
  async editDepartment(id: string, body: DepartmentEditDto): Promise<DepartmentChangedDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'organisation.manage')) {
      throw new ForbiddenException('The organisation is changed by an administrator.');
    }

    const moved = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const before = await tx.department.findUnique({
        where: { id },
        include: { costCentre: true, site: true },
      });

      if (!before) {
        throw new NotFoundException('No such department.');
      }

      const changes: Record<string, string | null> = {};
      const diff: AuditDiffEntry[] = [];

      if (body.name !== undefined && body.name.trim() !== '' && body.name.trim() !== before.name) {
        changes['name'] = body.name.trim().slice(0, 120);
        diff.push({ field: 'name', from: before.name, to: changes['name'] });
      }

      if (body.costCentreCode !== undefined) {
        const code = body.costCentreCode.trim();
        const centre = code === '' ? null : await tx.costCentre.findFirst({ where: { code } });

        if (code !== '' && !centre) {
          throw new BadRequestException('No such cost centre.');
        }

        const centreId = centre?.id ?? null;

        if (centreId !== before.costCentreId) {
          changes['costCentreId'] = centreId;
          diff.push({
            field: 'costCentre',
            from: before.costCentre?.code ?? '',
            to: centre?.code ?? '',
          });
        }
      }

      if (body.siteCode !== undefined) {
        const code = body.siteCode.trim();
        const site = code === '' ? null : await tx.site.findFirst({ where: { code } });

        if (code !== '' && !site) {
          throw new BadRequestException('No such site.');
        }

        if ((site?.id ?? null) !== before.siteId) {
          changes['siteId'] = site?.id ?? null;
          diff.push({ field: 'site', from: before.site?.code ?? '', to: site?.code ?? '' });
        }
      }

      if (body.headEmployeeId !== undefined) {
        const head = body.headEmployeeId.trim();
        const found =
          head === ''
            ? null
            : await tx.employee.findFirst({
                where: { id: head },
                select: { id: true, firstName: true, lastName: true },
              });

        if (head !== '' && !found) {
          throw new BadRequestException('No such employee.');
        }

        if ((found?.id ?? null) !== before.headEmployeeId) {
          changes['headEmployeeId'] = found?.id ?? null;
          diff.push({
            field: 'head',
            from: before.headEmployeeId ?? '',
            to: found ? `${found.firstName} ${found.lastName}` : '',
          });
        }
      }

      if (diff.length === 0) {
        return 0;
      }

      await tx.department.update({ where: { id }, data: changes });

      // The people in it follow, if that is what was asked and they have no cost
      // centre of their own.
      let employeesMoved = 0;

      if (body.applyToEmployees && 'costCentreId' in changes) {
        const result = await tx.employee.updateMany({
          where: { departmentId: id, costCentreOverride: false },
          data: { costCentreId: changes['costCentreId'] },
        });

        employeesMoved = result.count;
        diff.push({ field: 'employeesMoved', from: '0', to: String(employeesMoved) });
      }

      await this.audit.record(tx, user, {
        action: 'organisation.updated',
        entity: 'department',
        summary: before.name,
        diff,
      });

      return employeesMoved;
    });

    const organisation = await this.read();
    const department = organisation.departments.find((row) => row.id === id);

    if (!department) {
      throw new NotFoundException('No such department.');
    }

    return { department, employeesMoved: moved };
  }
}
