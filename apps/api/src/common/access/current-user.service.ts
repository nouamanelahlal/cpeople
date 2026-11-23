import { Injectable } from '@nestjs/common';
import {
  can,
  canSeeSensitive,
  capabilitiesOf,
  roleFromRealmRoles,
  type Capability,
  type Role,
} from '@cpeople/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantContextService } from '../tenant/tenant-context.service.js';

/**
 * Who is asking, in the terms the application thinks in (M02 / HR-01 section 5).
 *
 * The token says which realm roles they hold and which tenant they are in; this
 * turns that into one CPeople role, and finds the employee file that belongs to
 * them — matched on the e-mail address their token carries, which is the same
 * address the employee row holds.
 *
 * Nothing here trusts the request: the roles come from a verified token, and the
 * tenant from its organisation claim, never from a header or a body.
 */
export interface CurrentUser {
  readonly subject: string;
  readonly name: string;
  readonly email?: string;
  readonly tenantId: string;
  readonly role: Role;
  readonly capabilities: readonly Capability[];
  /** Their own employee file, when they have one. An administrator may not. */
  readonly employeeId?: string;
}

@Injectable()
export class CurrentUserService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  /** The signed-in person, without touching the database. */
  current(): Omit<CurrentUser, 'employeeId'> {
    const principal = this.tenantContext.requirePrincipal();
    const role = roleFromRealmRoles(principal.roles);

    return {
      subject: principal.userId,
      name: principal.name,
      ...(principal.email ? { email: principal.email } : {}),
      tenantId: principal.organization.tenantId,
      role,
      capabilities: capabilitiesOf(role),
    };
  }

  /** The same, with the employee file that is theirs, when one matches. */
  async withEmployee(): Promise<CurrentUser> {
    const user = this.current();
    if (user.email === undefined) {
      return user;
    }

    const employee = await this.prisma.forTenant(user.tenantId, (tx) =>
      tx.employee.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } },
        select: { id: true },
      }),
    );

    return employee ? { ...user, employeeId: employee.id } : user;
  }

  /** May this person do this? The question every write asks before it starts. */
  may(user: Pick<CurrentUser, 'role'>, capability: Capability): boolean {
    return can(user.role, capability);
  }

  /**
   * May this person see the private parts of this file?
   *
   * True for the roles that are allowed them, and for anyone reading their own
   * file: a manager cannot see their team's pay, but they can see their own.
   */
  maySeeSensitive(user: CurrentUser, employeeId?: string): boolean {
    return canSeeSensitive(user.role, {
      ownFile: employeeId !== undefined && employeeId === user.employeeId,
    });
  }
}
