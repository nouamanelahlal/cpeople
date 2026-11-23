import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { isSensitive, maskValue } from '@cpeople/shared';
import type { CurrentUser } from '../access/current-user.service.js';

/**
 * The trail (HR-01 spec 6.11, CLAUDE.md rule 5).
 *
 * Every change of consequence writes a row here, with who made it, the role they
 * were acting in, and what changed field by field. The application may insert and
 * read; it may not update or delete, which the database enforces — a trail that
 * can be edited is not one.
 *
 * Values are recorded as they are. Masking is for reading: a manager looking at
 * the history of a salary sees that it changed and not what to, and that decision
 * is taken when the entry is read, not when it is written, because the entry has
 * to stay true for the people who may see it.
 */
export interface AuditDiffEntry {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

export interface AuditEntry {
  readonly action: string;
  readonly entity: string;
  readonly entityId?: string;
  readonly summary: string;
  readonly diff?: readonly AuditDiffEntry[];
}

@Injectable()
export class AuditService {
  /** Writes one entry, inside the transaction that made the change. */
  async record(tx: TenantClient, user: CurrentUser, entry: AuditEntry): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.subject,
        actorName: user.name,
        actorRole: user.role,
        action: entry.action,
        entity: entry.entity,
        ...(entry.entityId ? { entityId: entry.entityId } : {}),
        summary: entry.summary,
        // Prisma takes a JSON column as plain JSON, which this already is.
        ...(entry.diff && entry.diff.length > 0
          ? { diff: entry.diff.map((change) => ({ ...change })) }
          : {}),
      },
    });
  }

  /**
   * One stored diff, as the reader is allowed to see it.
   *
   * A field they may not see keeps its name — "the salary changed" is a true and
   * useful thing to know — and loses both values.
   */
  readDiff(
    raw: unknown,
    options: { seeSensitive: boolean },
  ): { field: string; from: string; to: string; masked: boolean }[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((entry): entry is AuditDiffEntry => isDiffEntry(entry))
      .map((entry) => {
        const hide = isSensitive(entry.field) && !options.seeSensitive;

        return {
          field: entry.field,
          from: hide ? maskValue(entry.from) : entry.from,
          to: hide ? maskValue(entry.to) : entry.to,
          masked: hide,
        };
      });
  }
}

function isDiffEntry(value: unknown): value is AuditDiffEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry['field'] === 'string' &&
    typeof entry['from'] === 'string' &&
    typeof entry['to'] === 'string'
  );
}
