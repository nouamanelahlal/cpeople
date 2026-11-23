import { Injectable } from '@nestjs/common';
import type { ContractStatus, TenantClient } from '@cpeople/db';
import { documentState } from '@cpeople/shared';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { employeeScope, visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { expiringDocumentFilter, orNothing } from '../../common/documents/expiring.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type { EmployeeFacetsDto, EmployeeListDto } from './dto/employee-list.dto.js';
import type { EmployeeQuery } from './dto/employee-query.dto.js';

/**
 * How far ahead "ending soon" looks for a contract.
 *
 * Documents have no single window — each kind says how much warning it needs —
 * so they are asked for through common/documents/expiring.ts instead.
 */
const SOON_DAYS = 30;

/**
 * How many files the one sort that orders in memory will read.
 *
 * It is a page of a list, not a report: a tenant with more people than this
 * sorted by contract end gets the first thousand by name, ordered by their end
 * date, which is the screen's purpose. The demo company is 148.
 */
const SORT_CAP = 1_000;

type EmployeeWhere = NonNullable<Parameters<TenantClient['employee']['count']>[0]>['where'];
type PaperState = 'ok' | 'expiring' | 'expired';

/**
 * The employee list (HR-01 spec 6.2).
 *
 * Three things decide what comes back, in this order: the files this person may
 * see at all, the filters they asked for, and the page they are on. The first is
 * not negotiable and is applied here rather than in the query string, so no
 * request can widen it.
 */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
  ) {}

  async list(query: EmployeeQuery): Promise<EmployeeListDto> {
    const user = await this.users.withEmployee();
    const today = demoToday();
    const soon = addDays(today, SOON_DAYS);
    // Searching by national identifier is searching a sensitive field: it is
    // allowed only to the roles that may read one.
    const searchesIdentifiers = this.users.may(user, 'employee.sensitive.read');

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const scope = employeeScope(await visibleEmployeeIds(tx, user));

      // Anyone still on the books, unless the leavers are asked for: a list that
      // opens with everyone who ever worked here is not the list HR wants.
      const onTheBooks: EmployeeWhere = query.includeLeavers
        ? scope
        : { ...scope, status: { in: ['active', 'onboarding'] } };

      const where: EmployeeWhere = {
        ...onTheBooks,
        ...(query.status ? { status: query.status } : {}),
        ...(query.department ? { department: { code: query.department } } : {}),
        ...(query.site ? { site: { code: query.site } } : {}),
        ...(query.contractType
          ? { contracts: { some: { ...running(), contractType: { code: query.contractType } } } }
          : {}),
        ...(query.view === 'documents-expiring'
          ? { documents: { some: orNothing(await expiringDocumentFilter(tx, today)) } }
          : {}),
        ...(query.view === 'contracts-ending'
          ? { contracts: { some: { ...running(), endDate: { gte: date(today), lte: date(soon) } } } }
          : {}),
        ...search(query.q, searchesIdentifiers),
      };

      // Contract end lives on a related row, and a database cannot be asked to
      // order by one through Prisma. So that one sort reads the matching files
      // and orders them here — bounded, because what it reads is this reader's
      // scope and never the whole table.
      const inMemory = query.sort === 'contractEnd';
      const skip = (query.page - 1) * query.pageSize;

      const [total, visible, found, facets] = await Promise.all([
        tx.employee.count({ where }),
        tx.employee.count({ where: onTheBooks }),
        tx.employee.findMany({
          where,
          orderBy: orderFor(query),
          // Both given plainly rather than spread in: a conditional spread here
          // loses the shape of the query, and with it the types of the rows.
          skip: inMemory ? 0 : skip,
          take: inMemory ? SORT_CAP : query.pageSize,
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            status: true,
            hireDate: true,
            position: { select: { title: true } },
            department: { select: { code: true, name: true } },
            site: { select: { code: true, name: true } },
            contracts: {
              where: running(),
              orderBy: { startDate: 'desc' },
              take: 1,
              select: { endDate: true, contractType: { select: { code: true, name: true } } },
            },
          },
        }),
        this.#facets(tx, onTheBooks),
      ]);

      const rows = inMemory
        ? [...found].sort(byContractEnd(query.dir)).slice(skip, skip + query.pageSize)
        : found;

      const papers = await this.#papers(
        tx,
        rows.map((row) => row.id),
        today,
      );

      return {
        rows: rows.map((row) => {
          const contract = row.contracts[0];

          return {
            id: row.id,
            employeeNumber: row.employeeNumber,
            name: `${row.firstName} ${row.lastName}`,
            initials: `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.toUpperCase(),
            position: row.position.title,
            department: row.department,
            ...(row.site ? { site: row.site } : {}),
            ...(contract ? { contractType: contract.contractType } : {}),
            ...(contract?.endDate ? { contractEnd: plainDate(contract.endDate) } : {}),
            status: row.status,
            hireDate: plainDate(row.hireDate),
            documents: papers.get(row.id) ?? 'ok',
          };
        }),
        total,
        visible,
        page: query.page,
        pageSize: query.pageSize,
        pages: Math.max(1, Math.ceil(total / query.pageSize)),
        facets,
        today,
        searchesIdentifiers,
        mayCreate: this.users.may(user, 'employee.create'),
        mayExport: this.users.may(user, 'data.export'),
      };
    });
  }

  /**
   * What can be filtered by, counted over the files this person may see.
   *
   * The counts are part of the filter: "Kitchen 46" tells a manager what their
   * list is made of, and tells HR where the fixed terms are. A department's own
   * `_count` would include people this reader may not see, so every choice is
   * counted over the same scope as the list itself.
   */
  async #facets(tx: TenantClient, visible: EmployeeWhere): Promise<EmployeeFacetsDto> {
    const [departments, sites, contractTypes] = await Promise.all([
      tx.department.findMany({
        where: { employees: { some: visible } },
        orderBy: { name: 'asc' },
        select: { code: true, name: true },
      }),
      tx.site.findMany({
        where: { employees: { some: visible } },
        orderBy: { name: 'asc' },
        select: { code: true, name: true },
      }),
      tx.contractType.findMany({ orderBy: { name: 'asc' }, select: { code: true, name: true } }),
    ]);

    const count = async (extra: EmployeeWhere): Promise<number> =>
      tx.employee.count({ where: { ...visible, ...extra } });

    const [departmentCounts, siteCounts, typeCounts] = await Promise.all([
      Promise.all(departments.map((item) => count({ department: { code: item.code } }))),
      Promise.all(sites.map((item) => count({ site: { code: item.code } }))),
      Promise.all(
        contractTypes.map((item) =>
          count({ contracts: { some: { ...running(), contractType: { code: item.code } } } }),
        ),
      ),
    ]);

    const withCounts = (
      items: { code: string; name: string }[],
      counts: number[],
    ): { code: string; name: string; count: number }[] =>
      items
        .map((item, index) => ({ ...item, count: counts[index] ?? 0 }))
        .filter((item) => item.count > 0);

    return {
      departments: withCounts(departments, departmentCounts),
      sites: withCounts(sites, siteCounts),
      contractTypes: withCounts(contractTypes, typeCounts),
    };
  }

  /**
   * The state of each person's papers: the soonest expiry decides.
   *
   * One question for the whole page rather than one per row, and the same rule as
   * the home screen's count, so the dot and the figure agree.
   */
  async #papers(
    tx: TenantClient,
    ids: string[],
    today: string,
  ): Promise<Map<string, PaperState>> {
    const state = new Map<string, PaperState>();
    if (ids.length === 0) {
      return state;
    }

    // Read rather than grouped: the state of a document depends on the kind of
    // document it is, so the soonest date alone cannot answer it.
    const papers = await tx.employeeDocument.findMany({
      where: { employeeId: { in: ids }, expiryDate: { not: null } },
      select: {
        employeeId: true,
        expiryDate: true,
        documentType: { select: { alertDaysBefore: true } },
      },
    });

    const rank: Record<PaperState, number> = { ok: 0, expiring: 1, expired: 2 };

    for (const paper of papers) {
      const found = documentState(
        plainDate(paper.expiryDate!),
        today,
        paper.documentType.alertDaysBefore,
      );
      // The worst thing in a file is what the row says about it.
      const as: PaperState = found === 'valid' ? 'ok' : found;
      const current = state.get(paper.employeeId) ?? 'ok';

      if (rank[as] > rank[current]) {
        state.set(paper.employeeId, as);
      }
    }

    return state;
  }
}

/** The contract someone is working under: the one that has not ended. */
const RUNNING: ContractStatus[] = ['draft', 'generated', 'signed'];

function running(): { status: { in: ContractStatus[] } } {
  return { status: { in: RUNNING } };
}

/**
 * Searching, as a person types rather than as a database thinks.
 *
 * Every word has to match something — a first name, a last name, an employee
 * number — so "benali salma" and "salma benali" both find her. The national
 * identifier is matched whole, and only for a reader allowed to read one: a
 * partial match on an identifier is a way to guess at it.
 */
function search(q: string, identifiers: boolean): EmployeeWhere {
  if (q === '') {
    return {};
  }

  const words = q.split(/\s+/).filter((word) => word.length > 0);

  return {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: 'insensitive' as const } },
        { lastName: { contains: word, mode: 'insensitive' as const } },
        { employeeNumber: { contains: word, mode: 'insensitive' as const } },
        ...(identifiers && words.length === 1
          ? [{ nationalId: { equals: word, mode: 'insensitive' as const } }]
          : []),
      ],
    })),
  };
}

/** Sorted by what was asked for, and by name within that, so a page never shuffles. */
function orderFor(query: EmployeeQuery) {
  const dir = query.dir;

  if (query.sort === 'hireDate') {
    return [{ hireDate: dir }, { lastName: 'asc' as const }, { firstName: 'asc' as const }];
  }

  // Contract end is ordered after the fact; by name here so what is read is
  // steady, and so the cap always takes the same files.
  return [{ lastName: query.sort === 'name' ? dir : 'asc' }, { firstName: 'asc' as const }];
}

/**
 * By when the contract runs out, soonest first.
 *
 * A contract with no end date has nothing to run out, so those come last either
 * way: someone sorting by contract end is looking at the ones that end.
 */
function byContractEnd(dir: 'asc' | 'desc') {
  return (
    left: { contracts: { endDate: Date | null }[] },
    right: { contracts: { endDate: Date | null }[] },
  ): number => {
    const a = left.contracts[0]?.endDate?.getTime();
    const b = right.contracts[0]?.endDate?.getTime();

    if (a === undefined && b === undefined) return 0;
    if (a === undefined) return 1;
    if (b === undefined) return -1;

    return dir === 'asc' ? a - b : b - a;
  };
}

function date(plain: string): Date {
  return new Date(`${plain}T00:00:00Z`);
}

function addDays(plain: string, days: number): string {
  const moved = new Date(`${plain}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return plainDate(moved);
}
