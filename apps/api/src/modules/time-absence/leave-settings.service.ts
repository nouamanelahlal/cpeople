import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@cpeople/db';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService, type AuditDiffEntry } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import type {
  HolidayCreateDto,
  LeavePolicyEditDto,
  LeaveRuleCreateDto,
  LeaveSettingsDto,
  LeaveTypeEditDto,
  WorkWeekCreateDto,
} from './dto/leave-settings.dto.js';

/** What the screen falls back to when a tenant has no settings row yet. */
const DEFAULT_POLICY = { teamOffWarningPercent: 33, leaveYearStart: '01-01' };

/**
 * Leave set-up: the types, what each is worth, the working week, the calendar
 * (HR-02 / M08).
 *
 * Three things make this module what it is, and all three are the same idea:
 *
 *  - **Nothing legal is in the code.** How many days annual leave gives, how it
 *    accrues, how much carries over — every one of those is a row an
 *    administrator enters, and every seeded row says out loud that it is a demo
 *    value waiting for the payroll expert.
 *  - **Parameters keep their history.** Changing a rule writes a new row from a
 *    date and closes the previous one; it never edits what was true last year,
 *    because a balance calculated then still has to be explicable.
 *  - **Holidays are entered, never calculated.** Several Moroccan holidays move
 *    with the lunar calendar, and a wrong date silently changes what every
 *    request costs.
 */
@Injectable()
export class LeaveSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  async read(year?: number): Promise<LeaveSettingsDto> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'settings.view')) {
      throw new ForbiddenException('Leave set-up is for HR and administrators.');
    }

    const today = demoToday();
    const asked = Number.isFinite(year) ? Number(year) : Number(today.slice(0, 4));

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const [types, workWeeks, holidays, allHolidays, policy] = await Promise.all([
        tx.leaveType.findMany({
          orderBy: { sortOrder: 'asc' },
          include: { rules: { orderBy: { effectiveFrom: 'desc' } } },
        }),
        tx.siteWorkWeek.findMany({
          orderBy: [{ effectiveFrom: 'desc' }],
          include: { site: { select: { id: true, code: true, name: true } } },
        }),
        tx.publicHoliday.findMany({
          where: {
            date: {
              gte: date(`${asked}-01-01`),
              lte: date(`${asked}-12-31`),
            },
          },
          orderBy: { date: 'asc' },
        }),
        tx.publicHoliday.findMany({ select: { date: true } }),
        tx.leaveSettings.findFirst(),
      ]);

      // One row per site: the one in force today, which is the newest that has
      // already started.
      const current = new Map<string, (typeof workWeeks)[number]>();
      for (const week of workWeeks) {
        if (plainDate(week.effectiveFrom) <= today && !current.has(week.siteId)) {
          current.set(week.siteId, week);
        }
      }

      return {
        types: types.map((type) => {
          const rules = type.rules.map((rule) => this.#rule(rule));
          const inForce = rules.find((rule) => rule.effectiveFrom <= today);

          return {
            id: type.id,
            code: type.code,
            name: type.name,
            paid: type.paid,
            requiresDocument: type.requiresDocument,
            dayBasis: type.dayBasis,
            allowsHalfDays: type.allowsHalfDays,
            requiresSecondApproval: type.requiresSecondApproval,
            tracksBalance: type.tracksBalance,
            active: type.active,
            ...(inForce ? { rule: inForce } : {}),
            rules,
          };
        }),
        workWeeks: [...current.values()]
          .sort((left, right) => left.site.name.localeCompare(right.site.name))
          .map((week) => ({
            id: week.id,
            site: week.site,
            workingDays: [...week.workingDays].sort((a, b) => a - b),
            effectiveFrom: plainDate(week.effectiveFrom),
            ...(week.note ? { note: week.note } : {}),
            confirmed: week.confirmed,
          })),
        holidays: holidays.map((holiday) => ({
          id: holiday.id,
          date: plainDate(holiday.date),
          name: holiday.name,
          countryCode: holiday.countryCode,
          confirmed: holiday.confirmed,
          ...(holiday.note ? { note: holiday.note } : {}),
        })),
        holidayYears: [
          ...new Set(allHolidays.map((holiday) => Number(plainDate(holiday.date).slice(0, 4)))),
        ].sort(),
        year: asked,
        policy: {
          teamOffWarningPercent: policy?.teamOffWarningPercent ?? DEFAULT_POLICY.teamOffWarningPercent,
          leaveYearStart: policy?.leaveYearStart ?? DEFAULT_POLICY.leaveYearStart,
          ...(policy?.note ? { note: policy.note } : {}),
        },
        today,
        mayManage: this.users.may(user, 'leave.settings.manage'),
      };
    });
  }

  /** Changes what a leave type is. Its code never moves: things point at it. */
  async editType(id: string, body: LeaveTypeEditDto): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const before = await tx.leaveType.findUnique({ where: { id } });

      if (!before) {
        throw new NotFoundException('No such leave type.');
      }

      const changes: Prisma.LeaveTypeUpdateInput = {};
      const diff: AuditDiffEntry[] = [];

      const switches = [
        'paid',
        'requiresDocument',
        'allowsHalfDays',
        'requiresSecondApproval',
        'tracksBalance',
        'active',
      ] as const;

      for (const field of switches) {
        const next = body[field];
        if (next === undefined || next === before[field]) continue;

        changes[field] = next;
        diff.push({ field, from: String(before[field]), to: String(next) });
      }

      if (body.dayBasis && body.dayBasis !== before.dayBasis) {
        changes.dayBasis = body.dayBasis;
        diff.push({ field: 'dayBasis', from: before.dayBasis, to: body.dayBasis });
      }

      const name = body.name?.trim();
      if (name && name !== before.name) {
        changes.name = name.slice(0, 120);
        diff.push({ field: 'name', from: before.name, to: changes.name as string });
      }

      if (diff.length === 0) {
        return;
      }

      await tx.leaveType.update({ where: { id }, data: changes });
      await this.audit.record(tx, user, {
        action: 'leave.typeUpdated',
        entity: 'leaveType',
        entityId: id,
        summary: before.name,
        diff,
      });
    });

    return this.read();
  }

  /**
   * Writes a new rule for a leave type, from a date (CLAUDE.md rule 3).
   *
   * The row in force until then is closed the day before rather than changed, so
   * what the system believed last year can still be read back.
   */
  async addRule(leaveTypeId: string, body: LeaveRuleCreateDto): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();
    const effectiveFrom = plainOrThrow(body.effectiveFrom, 'start date');

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const type = await tx.leaveType.findUnique({ where: { id: leaveTypeId } });

      if (!type) {
        throw new NotFoundException('No such leave type.');
      }

      const previous = await tx.leaveRule.findFirst({
        where: { leaveTypeId, effectiveFrom: { lt: date(effectiveFrom) } },
        orderBy: { effectiveFrom: 'desc' },
      });

      const clash = await tx.leaveRule.findFirst({
        where: { leaveTypeId, effectiveFrom: date(effectiveFrom) },
      });

      if (clash) {
        throw new BadRequestException('There is already a rule starting on that date.');
      }

      await tx.leaveRule.create({
        data: {
          tenantId: user.tenantId,
          leaveTypeId,
          effectiveFrom: date(effectiveFrom),
          ...numeric('entitlementDays', body.entitlementDays),
          ...numeric('accrualPerMonth', body.accrualPerMonth),
          ...numeric('carryOverMaxDays', body.carryOverMaxDays),
          minNoticeDays: whole(body.minNoticeDays, previous?.minNoticeDays ?? 0),
          maxBackdateDays: whole(body.maxBackdateDays, previous?.maxBackdateDays ?? 0),
          ...(body.note?.trim() ? { note: body.note.trim().slice(0, 240) } : {}),
          confirmed: body.confirmed === true,
        },
      });

      if (previous) {
        await tx.leaveRule.update({
          where: { id: previous.id },
          data: { effectiveTo: date(addDays(effectiveFrom, -1)) },
        });
      }

      await this.audit.record(tx, user, {
        action: 'leave.ruleAdded',
        entity: 'leaveType',
        entityId: leaveTypeId,
        summary: type.name,
        diff: [
          { field: 'effectiveFrom', from: '', to: effectiveFrom },
          {
            field: 'entitlementDays',
            from: previous?.entitlementDays?.toString() ?? '',
            to: body.entitlementDays === undefined || body.entitlementDays === null
              ? ''
              : String(body.entitlementDays),
          },
          { field: 'confirmed', from: String(previous?.confirmed ?? false), to: String(body.confirmed === true) },
        ],
      });
    });

    return this.read();
  }

  /** Sets a site's working week from a date. Same history rule as the rules. */
  async setWorkWeek(body: WorkWeekCreateDto): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();
    const effectiveFrom = plainOrThrow(body.effectiveFrom, 'start date');
    const workingDays = [...new Set(body.workingDays ?? [])]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const site = await tx.site.findFirst({ where: { code: body.siteCode?.trim() } });

      if (!site) {
        throw new NotFoundException('No such site.');
      }

      const before = await tx.siteWorkWeek.findFirst({
        where: { siteId: site.id },
        orderBy: { effectiveFrom: 'desc' },
      });

      await tx.siteWorkWeek.upsert({
        where: {
          tenantId_siteId_effectiveFrom: {
            tenantId: user.tenantId,
            siteId: site.id,
            effectiveFrom: date(effectiveFrom),
          },
        },
        create: {
          tenantId: user.tenantId,
          siteId: site.id,
          workingDays,
          effectiveFrom: date(effectiveFrom),
          ...(body.note?.trim() ? { note: body.note.trim().slice(0, 240) } : {}),
          confirmed: body.confirmed === true,
        },
        update: {
          workingDays,
          ...(body.note?.trim() ? { note: body.note.trim().slice(0, 240) } : {}),
          confirmed: body.confirmed === true,
        },
      });

      await this.audit.record(tx, user, {
        action: 'leave.workWeekSet',
        entity: 'site',
        entityId: site.id,
        summary: site.name,
        diff: [
          {
            field: 'workingDays',
            from: (before?.workingDays ?? []).join(','),
            to: workingDays.join(','),
          },
          { field: 'effectiveFrom', from: '', to: effectiveFrom },
        ],
      });
    });

    return this.read();
  }

  /** Adds a public holiday. Entered, because it cannot be calculated. */
  async addHoliday(body: HolidayCreateDto): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();
    const on = plainOrThrow(body.date, 'date');
    const name = body.name?.trim();

    if (!name) {
      throw new BadRequestException('A public holiday needs a name.');
    }

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const countryCode = (body.countryCode?.trim() || 'MA').slice(0, 2).toUpperCase();

      const clash = await tx.publicHoliday.findFirst({ where: { countryCode, date: date(on) } });

      if (clash) {
        throw new BadRequestException('That day is already a public holiday.');
      }

      await tx.publicHoliday.create({
        data: {
          tenantId: user.tenantId,
          countryCode,
          date: date(on),
          name: name.slice(0, 120),
          confirmed: body.confirmed === true,
        },
      });

      await this.audit.record(tx, user, {
        action: 'leave.holidayAdded',
        entity: 'publicHoliday',
        summary: `${on} — ${name}`,
        diff: [{ field: 'date', from: '', to: on }],
      });
    });

    return this.read(Number(on.slice(0, 4)));
  }

  async removeHoliday(id: string): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();
    let year = Number(demoToday().slice(0, 4));

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const holiday = await tx.publicHoliday.findUnique({ where: { id } });

      if (!holiday) {
        throw new NotFoundException('No such public holiday.');
      }

      year = Number(plainDate(holiday.date).slice(0, 4));
      await tx.publicHoliday.delete({ where: { id } });

      await this.audit.record(tx, user, {
        action: 'leave.holidayRemoved',
        entity: 'publicHoliday',
        summary: `${plainDate(holiday.date)} — ${holiday.name}`,
        diff: [{ field: 'date', from: plainDate(holiday.date), to: '' }],
      });
    });

    return this.read(year);
  }

  /** Marks a whole year's holidays as checked by the client. */
  async confirmYear(year: number): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('That is not a year.');
    }

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const { count } = await tx.publicHoliday.updateMany({
        where: {
          confirmed: false,
          date: { gte: date(`${year}-01-01`), lte: date(`${year}-12-31`) },
        },
        data: { confirmed: true },
      });

      if (count === 0) {
        return;
      }

      await this.audit.record(tx, user, {
        action: 'leave.holidaysConfirmed',
        entity: 'publicHoliday',
        summary: String(year),
        diff: [{ field: 'confirmed', from: String(count), to: '0' }],
      });
    });

    return this.read(year);
  }

  /** The company-wide decisions: the warning threshold and the leave year. */
  async setPolicy(body: LeavePolicyEditDto): Promise<LeaveSettingsDto> {
    const user = await this.#mayManage();

    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const before = await tx.leaveSettings.findFirst();

      const percent =
        body.teamOffWarningPercent === undefined
          ? (before?.teamOffWarningPercent ?? DEFAULT_POLICY.teamOffWarningPercent)
          : Math.min(100, Math.max(1, Math.round(body.teamOffWarningPercent)));

      const yearStart = (body.leaveYearStart ?? before?.leaveYearStart ?? DEFAULT_POLICY.leaveYearStart).trim();

      if (!/^\d{2}-\d{2}$/.test(yearStart)) {
        throw new BadRequestException('The leave year starts on a day and a month, as MM-DD.');
      }

      await tx.leaveSettings.upsert({
        where: { tenantId: user.tenantId },
        create: {
          tenantId: user.tenantId,
          teamOffWarningPercent: percent,
          leaveYearStart: yearStart,
        },
        update: { teamOffWarningPercent: percent, leaveYearStart: yearStart },
      });

      await this.audit.record(tx, user, {
        action: 'leave.policyUpdated',
        entity: 'leaveSettings',
        summary: 'Leave policy',
        diff: [
          {
            field: 'teamOffWarningPercent',
            from: String(before?.teamOffWarningPercent ?? DEFAULT_POLICY.teamOffWarningPercent),
            to: String(percent),
          },
          {
            field: 'leaveYearStart',
            from: before?.leaveYearStart ?? DEFAULT_POLICY.leaveYearStart,
            to: yearStart,
          },
        ],
      });
    });

    return this.read();
  }

  async #mayManage(): Promise<CurrentUser> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.settings.manage')) {
      throw new ForbiddenException('Leave set-up is changed by HR and administrators.');
    }

    return user;
  }

  #rule(rule: {
    id: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    entitlementDays: Prisma.Decimal | null;
    accrualPerMonth: Prisma.Decimal | null;
    carryOverMaxDays: Prisma.Decimal | null;
    minNoticeDays: number;
    maxBackdateDays: number;
    note: string | null;
    confirmed: boolean;
  }) {
    return {
      id: rule.id,
      effectiveFrom: plainDate(rule.effectiveFrom),
      ...(rule.effectiveTo ? { effectiveTo: plainDate(rule.effectiveTo) } : {}),
      ...(rule.entitlementDays === null ? {} : { entitlementDays: rule.entitlementDays.toNumber() }),
      ...(rule.accrualPerMonth === null ? {} : { accrualPerMonth: rule.accrualPerMonth.toNumber() }),
      ...(rule.carryOverMaxDays === null
        ? {}
        : { carryOverMaxDays: rule.carryOverMaxDays.toNumber() }),
      minNoticeDays: rule.minNoticeDays,
      maxBackdateDays: rule.maxBackdateDays,
      ...(rule.note ? { note: rule.note } : {}),
      confirmed: rule.confirmed,
    };
  }
}

/** Only sent when it was asked for: null clears a value, undefined leaves it. */
function numeric(field: string, value: number | null | undefined): Record<string, number | null> {
  if (value === undefined) return {};
  return { [field]: value === null ? null : Number(value) };
}

function whole(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.max(0, Math.round(value));
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

function addDays(plain: string, days: number): string {
  const moved = new Date(`${plain}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
