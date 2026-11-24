import { ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Where punches come from (HR-02 build spec §5.1 and §5.7).
 *
 * Two sources, and the difference between them is the point of the screen:
 *
 *  - **the daily file**, which works today and is what go-live will use;
 *  - **the device API**, which is shown switched off, with the reason and the
 *    date it depends on. Never a simulated connection: a demo that pretends to
 *    talk to a turnstile is a demo that has to be un-promised later.
 *
 * The **mapping** is the part that earns its keep. Every provider names its
 * columns differently, and the answer to that has to be a setting somebody can
 * change in a meeting — not a release.
 */
export interface SourceMapping {
  readonly employeeNumber: string;
  readonly timestamp: string;
  readonly direction: string;
  readonly deviceId: string;
}

export const DEFAULT_MAPPING: SourceMapping = {
  employeeNumber: 'employee_number',
  timestamp: 'timestamp',
  direction: 'direction',
  deviceId: 'device_id',
};

/** The two sources every tenant starts with. */
const SEEDED = [
  {
    name: 'Daily file',
    type: 'file' as const,
    status: 'active' as const,
    mapping: DEFAULT_MAPPING,
  },
  {
    name: 'Device API',
    type: 'api' as const,
    status: 'planned' as const,
    mapping: DEFAULT_MAPPING,
  },
];

export interface SourceView {
  readonly id: string;
  readonly name: string;
  readonly type: 'file' | 'api';
  readonly status: 'active' | 'planned';
  readonly mapping: SourceMapping;
  readonly timezone: string;
  readonly duplicateWindowSeconds: number;
  readonly endpoint?: string;
  readonly lastImportAt?: string;
}

@Injectable()
export class AttendanceSourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The sources, creating the two defaults the first time anybody looks.
   *
   * Made on demand rather than in the seed so that a tenant provisioned later
   * has them too — this is configuration every company needs, not demo data.
   */
  async list(): Promise<{ sources: SourceView[]; mayManage: boolean }> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'attendance.view')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await this.#ensure(tx, user);

      const rows = await tx.attendanceSource.findMany({ orderBy: { type: 'asc' } });

      return {
        sources: rows.map((row) => this.#view(row)),
        mayManage: this.users.may(user, 'attendance.settings.manage'),
      };
    });
  }

  /**
   * Changes a source's mapping or its settings.
   *
   * A planned source cannot be switched on from here: it is switched on when
   * the provider confirms the interface, which is a decision and not a toggle.
   */
  async update(
    id: string,
    body: {
      mapping?: Partial<SourceMapping>;
      timezone?: string;
      duplicateWindowSeconds?: number;
    },
  ): Promise<SourceView> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'attendance.settings.manage')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const before = await tx.attendanceSource.findUniqueOrThrow({ where: { id } });
      const previous = readMapping(before.mapping);

      const mapping: SourceMapping = {
        employeeNumber: body.mapping?.employeeNumber?.trim() || previous.employeeNumber,
        timestamp: body.mapping?.timestamp?.trim() || previous.timestamp,
        direction: body.mapping?.direction?.trim() || previous.direction,
        deviceId: body.mapping?.deviceId?.trim() || previous.deviceId,
      };

      const seconds = Number.isFinite(body.duplicateWindowSeconds)
        ? Math.min(Math.max(Number(body.duplicateWindowSeconds), 0), 3600)
        : before.duplicateWindowSeconds;

      const row = await tx.attendanceSource.update({
        where: { id },
        data: {
          mapping: { ...mapping },
          timezone: body.timezone?.trim() || before.timezone,
          duplicateWindowSeconds: seconds,
        },
      });

      const diff = (Object.keys(mapping) as (keyof SourceMapping)[])
        .filter((field) => previous[field] !== mapping[field])
        .map((field) => ({ field, from: previous[field], to: mapping[field] }));

      if (seconds !== before.duplicateWindowSeconds) {
        diff.push({
          field: 'duplicateWindowSeconds' as keyof SourceMapping,
          from: String(before.duplicateWindowSeconds),
          to: String(seconds),
        });
      }

      if (diff.length > 0) {
        await this.audit.record(tx, user, {
          action: 'attendance.sourceUpdated',
          entity: 'attendanceSource',
          entityId: id,
          summary: before.name,
          diff,
        });
      }

      return this.#view(row);
    });
  }

  async #ensure(tx: TenantClient, user: CurrentUser): Promise<void> {
    const count = await tx.attendanceSource.count();
    if (count > 0) return;

    for (const source of SEEDED) {
      await tx.attendanceSource.create({
        data: {
          tenantId: user.tenantId,
          name: source.name,
          type: source.type,
          status: source.status,
          mapping: { ...source.mapping },
          ...(source.type === 'api'
            ? {
                note:
                  'Switched on when the device provider confirms the interface ' +
                  '(P09, 15 December 2026). Until then the daily file is used.',
              }
            : {}),
        },
      });
    }
  }

  #view(row: {
    id: string;
    name: string;
    type: string;
    status: string;
    mapping: unknown;
    timezone: string;
    duplicateWindowSeconds: number;
    endpoint: string | null;
  }): SourceView {
    return {
      id: row.id,
      name: row.name,
      type: row.type as 'file' | 'api',
      status: row.status as 'active' | 'planned',
      mapping: readMapping(row.mapping),
      timezone: row.timezone,
      duplicateWindowSeconds: row.duplicateWindowSeconds,
      ...(row.endpoint ? { endpoint: row.endpoint } : {}),
    };
  }
}

/** A stored mapping, with anything missing filled in from the default. */
export function readMapping(value: unknown): SourceMapping {
  const raw = (value ?? {}) as Partial<Record<keyof SourceMapping, unknown>>;
  const text = (field: keyof SourceMapping): string =>
    typeof raw[field] === 'string' && raw[field] !== '' ? (raw[field] as string) : DEFAULT_MAPPING[field];

  return {
    employeeNumber: text('employeeNumber'),
    timestamp: text('timestamp'),
    direction: text('direction'),
    deviceId: text('deviceId'),
  };
}
