import type { TenantClient } from '@cpeople/db';
import { can } from '@cpeople/shared';
import type { CurrentUser } from './current-user.service.js';

/**
 * Which employee files this person may see at all (HR-01 section 5).
 *
 * HR and administrators see everyone. A manager sees their own branch of the
 * organisation — the people who report to them, and the people who report to
 * those — which is what "own team" means once there is a supervisor in between.
 * Anyone else sees their own file and nothing else.
 *
 * It returns a list of ids rather than a clever join so that every query in the
 * module filters the same way, and a query that forgets to filter returns the
 * empty list instead of the company.
 */
export async function visibleEmployeeIds(
  tx: TenantClient,
  user: CurrentUser,
): Promise<'all' | string[]> {
  if (can(user.role, 'employee.list.all')) {
    return 'all';
  }

  if (user.employeeId === undefined) {
    return [];
  }

  if (!can(user.role, 'employee.list.team')) {
    return [user.employeeId];
  }

  // The branch below this person, however deep it goes. Inside withTenant, so the
  // row-level-security policies apply to the recursion as they do to everything.
  const rows = await tx.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE team AS (
      SELECT id FROM employee WHERE id = ${user.employeeId}::uuid
      UNION
      SELECT e.id FROM employee e JOIN team t ON e.manager_id = t.id
    )
    SELECT id FROM team
  `;

  return rows.map((row) => row.id);
}

/** The same answer as a Prisma filter, ready to spread into a `where`. */
export function employeeScope(ids: 'all' | string[]): { id?: { in: string[] } } {
  return ids === 'all' ? {} : { id: { in: ids } };
}
