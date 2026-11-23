import { Injectable } from '@nestjs/common';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { employeeScope, visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ChartDto, ChartNodeDto } from './dto/chart.dto.js';

/**
 * The organisation chart (HR-01 spec 6.9).
 *
 * The tree people actually work in — who reports to whom — rather than the one
 * the position titles imply. It is built from the files this reader may see, so
 * a manager's chart is their own branch and begins with them: not a filtered
 * version of the company with gaps in it, but the part of it that is theirs.
 *
 * Built here rather than in the browser because the scope is decided here
 * anyway, and a tree assembled from a list the browser was handed is a tree the
 * browser could have been handed wrong.
 */
@Injectable()
export class ChartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
  ) {}

  async chart(department?: string): Promise<ChartDto> {
    const user = await this.users.withEmployee();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const ids = await visibleEmployeeIds(tx, user);
      const scope = employeeScope(ids);

      const people = await tx.employee.findMany({
        where: {
          ...scope,
          status: { in: ['active', 'onboarding'] },
          ...(department ? { department: { code: department } } : {}),
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          managerId: true,
          status: true,
          position: { select: { title: true } },
          department: { select: { code: true, name: true } },
        },
      });

      const departments = await tx.department.findMany({
        where: { employees: { some: { ...scope, status: { in: ['active', 'onboarding'] } } } },
        orderBy: { name: 'asc' },
        select: { code: true, name: true },
      });

      const nodes = new Map<string, ChartNodeDto>();

      for (const person of people) {
        nodes.set(person.id, {
          id: person.id,
          name: `${person.firstName} ${person.lastName}`,
          initials: `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase(),
          position: person.position.title,
          department: person.department,
          status: person.status,
          reports: 0,
          children: [],
        });
      }

      const roots: ChartNodeDto[] = [];

      for (const person of people) {
        const node = nodes.get(person.id)!;
        // Someone whose manager is outside what this reader may see — or outside
        // the department being looked at — stands at the top of their own branch
        // rather than disappearing.
        const manager = person.managerId ? nodes.get(person.managerId) : undefined;

        if (manager) {
          manager.children.push(node);
          manager.reports += 1;
        } else {
          roots.push(node);
        }
      }

      return {
        roots,
        total: people.length,
        departments,
        ...(department ? { department } : {}),
        // Said plainly rather than guessed at from the shape of the tree: a
        // department filtered down to one branch looks exactly like a manager's
        // own branch, and they are not the same thing to say.
        scope: this.users.may(user, 'employee.list.all')
          ? 'all'
          : this.users.may(user, 'employee.list.team')
            ? 'team'
            : 'own',
      };
    });
  }
}
