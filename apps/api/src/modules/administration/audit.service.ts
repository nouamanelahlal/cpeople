import { ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuditPageDto } from './dto/audit.dto.js';

/** How many entries one page of the trail holds. */
const PAGE_SIZE = 50;

/**
 * The company's trail (HR-01 spec 6.11).
 *
 * The same rows the history tab of a file shows, read across the whole company
 * instead of one person. It is HR's and the administrator's: a manager can see
 * what happened to their own team's files, from those files, which is as far as
 * their business goes.
 *
 * Filters arrive in step 13. What is here is the list the demo opens at 13:30 to
 * show that role switches and changes are recorded as they happen.
 */
@Injectable()
export class AuditReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  async page(options: { page?: number } = {}): Promise<AuditPageDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'audit.read')) {
      throw new ForbiddenException('The audit log is for HR and administrators.');
    }

    const page = Math.max(1, options.page ?? 1);
    const seeSensitive = this.users.may(user, 'employee.sensitive.read');

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const [total, rows] = await Promise.all([
        tx.auditEvent.count(),
        tx.auditEvent.findMany({
          orderBy: { at: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ]);

      return {
        entries: rows.map((row) => ({
          id: row.id,
          at: row.at.toISOString(),
          ...(row.actorName ? { actorName: row.actorName } : {}),
          ...(row.actorRole ? { actorRole: row.actorRole } : {}),
          action: row.action,
          entity: row.entity,
          ...(row.entityId ? { entityId: row.entityId } : {}),
          summary: row.summary,
          diff: this.audit.readDiff(row.diff, { seeSensitive }),
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    });
  }
}
