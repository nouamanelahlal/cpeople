// Leave requests for the demo company (M09 / HR-04).
//
// INVENTED DATA ONLY (CLAUDE.md rule 6). Nine requests, chosen so that every
// screen has something true to show and every rule has a worked example:
//
//   * one waiting on the head of kitchen, so a manager signing in has an inbox;
//   * one already approved by a supervisor and now waiting on the head of
//     kitchen as N+2, because unpaid leave needs a second yes;
//   * one from the general manager, who has nobody above them, so it went to HR;
//   * one crossing into 2027, whose holidays nobody has finished, so it carries
//     the warning that its count may still move;
//   * one sick leave, dated backwards and counted in calendar days;
//   * one approved and then asked to be cancelled, which still needs a yes;
//   * and three settled ones, so a balance has a history behind it.
//
// Every one of them is written with the same arithmetic the application uses —
// the shared day counter — and each carries the calculation rows that say how it
// was worked out, exactly as a real request would.

import { leaveDaysDetail, type DayPart, type LeaveDay } from '@cpeople/shared';
import type { CPeoplePrismaClient } from '../client.js';

/** The day the demo is set on, as everything else in the seed uses it. */
const TODAY = '2026-11-23';

interface Plan {
  /** How to find the person asking. */
  readonly who: { number?: string; role?: 'general' | 'kitchenSupervisor' | 'kitchenMember' };
  readonly type: string;
  readonly from: string;
  readonly to: string;
  readonly fromPart?: DayPart;
  readonly toPart?: DayPart;
  readonly reason?: string;
  /** Said by whoever decided it, where they refused. */
  readonly decisionReason?: string;
  /** Whether a certificate is filed against it. */
  readonly document?: boolean;
  /** Where it has got to, and therefore which rows go with it. */
  readonly outcome:
    | 'pending_n1'
    | 'pending_n2'
    | 'pending_hr'
    | 'approved'
    | 'rejected'
    | 'cancellation_pending';
}

const PLANS: readonly Plan[] = [
  // --- Away during the demo week (24-28 November) -----------------------
  // Four people, so "Away this week" on the home screen has four names in it
  // and the calendar has something to draw.
  {
    who: { number: '1004' },
    type: 'ANNUAL',
    from: '2026-11-23',
    to: '2026-11-27',
    outcome: 'approved',
  },
  {
    who: { number: '1007' },
    type: 'ANNUAL',
    from: '2026-11-24',
    to: '2026-11-26',
    outcome: 'approved',
  },
  {
    who: { role: 'kitchenMember' },
    type: 'ANNUAL',
    from: '2026-11-25',
    to: '2026-11-27',
    outcome: 'approved',
  },
  {
    who: { number: '1005' },
    type: 'SICK',
    from: '2026-11-23',
    to: '2026-11-25',
    reason: 'Signed off by the doctor until Wednesday.',
    document: true,
    outcome: 'approved',
  },

  // --- Waiting on somebody: six, two of them at N+2 ---------------------
  {
    who: { number: '1003' },
    type: 'ANNUAL',
    from: '2026-12-07',
    to: '2026-12-11',
    reason: 'Family trip to Fès.',
    outcome: 'pending_n1',
  },
  {
    who: { role: 'kitchenSupervisor' },
    type: 'ANNUAL',
    from: '2026-12-14',
    to: '2026-12-18',
    outcome: 'pending_n1',
  },
  {
    who: { number: '1008' },
    type: 'ANNUAL',
    from: '2026-12-21',
    to: '2026-12-24',
    outcome: 'pending_n1',
  },
  // Nobody is above the general manager, so this one went to HR instead of
  // being handed back to the person asking.
  {
    who: { role: 'general' },
    type: 'ANNUAL',
    from: '2027-01-04',
    to: '2027-01-08',
    outcome: 'pending_hr',
  },
  // Unpaid leave needs a second yes, so these two sit with the manager's
  // manager — the head of kitchen — rather than with the supervisor.
  {
    who: { number: '1003' },
    type: 'UNPAID',
    from: '2027-01-11',
    to: '2027-01-15',
    reason: 'Unpaid month to finish a diploma.',
    outcome: 'pending_n2',
  },
  {
    who: { number: '1009' },
    type: 'UNPAID',
    from: '2027-02-01',
    to: '2027-02-05',
    outcome: 'pending_n2',
  },

  // --- Decided, so the screens have a history ---------------------------
  // A refusal, with the reason the employee can read.
  {
    who: { number: '1004' },
    type: 'ANNUAL',
    from: '2026-12-28',
    to: '2027-01-01',
    reason: 'New Year in Marrakech.',
    outcome: 'rejected',
    decisionReason: 'The outlet is at its busiest that week. Please take it in January instead.',
  },
  // Approved, and now asked to be cancelled, which still needs a yes.
  {
    who: { number: '1008' },
    type: 'ANNUAL',
    from: '2026-12-02',
    to: '2026-12-04',
    outcome: 'cancellation_pending',
  },
  // Approved, and crossing into a year whose holidays nobody has finished: the
  // one the "to review" list is demonstrated on.
  {
    who: { number: '1009' },
    type: 'ANNUAL',
    from: '2026-12-28',
    to: '2027-01-04',
    outcome: 'approved',
  },
  // Settled history, so a balance has something behind it.
  {
    who: { number: '1003' },
    type: 'ANNUAL',
    from: '2026-07-06',
    to: '2026-07-17',
    outcome: 'approved',
  },
  // A half-day: an afternoon, which is where the fractions come from.
  {
    who: { number: '1003' },
    type: 'ANNUAL',
    from: '2026-10-09',
    to: '2026-10-09',
    fromPart: 'afternoon',
    toPart: 'afternoon',
    outcome: 'approved',
  },
];

export interface LeaveRequestSeedCounts {
  readonly requests: number;
  readonly pending: number;
}

/**
 * Seeds the demo's leave requests. Called after the employees and the leave
 * set-up exist, because every request hangs off both.
 */
export async function seedHr02Requests(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<LeaveRequestSeedCounts> {
  const cast = await findCast(prisma, tenantId);
  const types = new Map(
    (await prisma.leaveType.findMany({ where: { tenantId } })).map((type) => [type.code, type]),
  );
  const holidays = (
    await prisma.publicHoliday.findMany({ where: { tenantId }, select: { id: true, date: true } })
  ).map((holiday) => ({ id: holiday.id, date: plain(holiday.date) }));

  let requests = 0;
  let pending = 0;

  for (const plan of PLANS) {
    const employee = pick(cast, plan.who);
    const type = types.get(plan.type);
    if (!employee || !type) continue;

    const week = await prisma.siteWorkWeek.findFirst({
      where: { tenantId, siteId: employee.siteId ?? undefined },
      orderBy: { effectiveFrom: 'desc' },
    });

    const rule = await prisma.leaveRule.findFirst({
      where: { tenantId, leaveTypeId: type.id },
      orderBy: { effectiveFrom: 'desc' },
    });

    const span = {
      from: plan.from,
      to: plan.to,
      firstDayPart: plan.fromPart ?? ('full' as DayPart),
      lastDayPart: plan.toPart ?? ('full' as DayPart),
    };

    const inSpan = holidays.filter((holiday) => holiday.date >= plan.from && holiday.date <= plan.to);

    const days = leaveDaysDetail(span, {
      workingDays: week?.workingDays ?? [1, 2, 3, 4, 5],
      holidays: inSpan.map((holiday) => holiday.date),
      dayBasis: type.dayBasis,
    });

    const dayCount = round(days.reduce((sum, day) => sum + day.days, 0));
    const applied = new Set(days.filter((day) => day.reason === 'holiday').map((day) => day.date));

    const status = plan.outcome === 'cancellation_pending' ? 'cancellation_pending' : plan.outcome;
    const decided = plan.outcome === 'approved' || plan.outcome === 'rejected';

    const request = await prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: employee.id,
        leaveTypeId: type.id,
        status,
        startDate: day(plan.from),
        endDate: day(plan.to),
        startPart: span.firstDayPart,
        endPart: span.lastDayPart,
        ...(plan.reason ? { reason: plan.reason } : {}),
        dayCount,
        ...(employee.managerId ? { n1Id: employee.managerId } : {}),
        ...(employee.managerManagerId ? { n2Id: employee.managerManagerId } : {}),
        toHr: !employee.managerId,
        submittedAt: submittedAt(plan.from),
        ...(decided ? { decidedAt: submittedAt(plan.from) } : {}),
      },
    });

    const evidence = {
      tenantId,
      requestId: request.id,
      dayCount,
      days: days.map((entry: LeaveDay) => ({ ...entry })),
      ...(rule ? { leaveRuleId: rule.id } : {}),
      ...(week ? { workWeekId: week.id } : {}),
      holidayIds: inSpan.filter((holiday) => applied.has(holiday.date)).map((holiday) => holiday.id),
      workingDays: week?.workingDays ?? [1, 2, 3, 4, 5],
      dayBasis: type.dayBasis,
      // 2026 is marked finished by the seed below; 2027 is not.
      holidaysComplete: plan.from.startsWith('2026') && plan.to.startsWith('2026'),
    };

    await prisma.leaveCalculation.create({ data: { ...evidence, kind: 'submitted' } });

    await prisma.leaveDecision.create({
      data: {
        tenantId,
        requestId: request.id,
        kind: 'submitted',
        byEmployeeId: employee.id,
        byName: employee.name,
        byRole: 'employee',
      },
    });

    // The ones that were decided carry the approval too, with the calculation
    // that was made at the moment of approving — which is the row a balance and
    // a payroll month are entitled to rely on.
    if (plan.outcome === 'approved' || plan.outcome === 'cancellation_pending') {
      await prisma.leaveCalculation.create({ data: { ...evidence, kind: 'approved' } });

      await prisma.leaveDecision.create({
        data: {
          tenantId,
          requestId: request.id,
          kind: 'approved_n1',
          ...(employee.managerId ? { byEmployeeId: employee.managerId } : {}),
          byName: employee.managerName ?? 'HR',
          byRole: employee.managerId ? 'manager' : 'hr',
        },
      });
    }

    if (plan.outcome === 'rejected') {
      await prisma.leaveDecision.create({
        data: {
          tenantId,
          requestId: request.id,
          kind: 'rejected',
          ...(employee.managerId ? { byEmployeeId: employee.managerId } : {}),
          byName: employee.managerName ?? 'HR',
          byRole: 'manager',
          ...(plan.decisionReason ? { reason: plan.decisionReason } : {}),
        },
      });
    }

    if (plan.outcome === 'pending_n2') {
      await prisma.leaveDecision.create({
        data: {
          tenantId,
          requestId: request.id,
          kind: 'approved_n1',
          ...(employee.managerId ? { byEmployeeId: employee.managerId } : {}),
          byName: employee.managerName ?? 'HR',
          byRole: 'manager',
        },
      });
    }

    if (plan.outcome === 'cancellation_pending') {
      await prisma.leaveDecision.create({
        data: {
          tenantId,
          requestId: request.id,
          kind: 'cancellation_requested',
          byEmployeeId: employee.id,
          byName: employee.name,
          byRole: 'employee',
        },
      });
    }

    requests += 1;
    // "Waiting for a decision" is the six the workshop counts. A cancellation
    // waiting to be agreed is a different question, and is not one of them.
    if (status.startsWith('pending')) pending += 1;
  }

  return { requests, pending };
}

/** Removes everything this seeder owns. */
export async function clearHr02Requests(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<void> {
  const where = { tenantId };

  // Calculations and decisions hang off the requests and go with them, but the
  // seed deletes them itself rather than relying on a cascade it does not own.
  await prisma.leaveCalculation.deleteMany({ where });
  await prisma.leaveDecision.deleteMany({ where });
  await prisma.leaveRequest.deleteMany({ where });
  await prisma.publicHolidayYear.deleteMany({ where });
}

interface CastRow {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  readonly siteId: string | null;
  readonly managerId: string | null;
  readonly managerName?: string;
  readonly managerManagerId: string | null;
  readonly level: 'general' | 'head' | 'supervisor' | 'member';
  readonly department: string;
}

/**
 * The people the plans refer to, with their line of management resolved.
 *
 * Read from the organisation rather than written down here, so that the demo's
 * approval chains are the ones the organisation chart shows. If the seed's
 * hierarchy changes, these requests follow it.
 */
async function findCast(prisma: CPeoplePrismaClient, tenantId: string): Promise<CastRow[]> {
  const employees = await prisma.employee.findMany({
    where: { tenantId, status: 'active' },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      siteId: true,
      managerId: true,
      department: { select: { code: true } },
      manager: {
        select: { id: true, firstName: true, lastName: true, managerId: true },
      },
    },
    orderBy: { employeeNumber: 'asc' },
  });

  const byId = new Map(employees.map((row) => [row.id, row]));

  return employees.map((row) => {
    const reports = employees.filter((other) => other.managerId === row.id).length;

    const level: CastRow['level'] = !row.managerId
      ? 'general'
      : byId.get(row.managerId)?.managerId === null || byId.get(row.managerId)?.managerId === undefined
        ? 'head'
        : reports > 0
          ? 'supervisor'
          : 'member';

    return {
      id: row.id,
      number: row.employeeNumber,
      name: `${row.firstName} ${row.lastName}`,
      siteId: row.siteId,
      managerId: row.managerId,
      ...(row.manager ? { managerName: `${row.manager.firstName} ${row.manager.lastName}` } : {}),
      managerManagerId: row.manager?.managerId ?? null,
      level,
      department: row.department?.code ?? '',
    };
  });
}

function pick(cast: CastRow[], who: Plan['who']): CastRow | undefined {
  if (who.number) {
    return cast.find((row) => row.number === who.number);
  }

  switch (who.role) {
    case 'general':
      return cast.find((row) => row.level === 'general');
    case 'kitchenSupervisor':
      return cast.find((row) => row.department === 'KIT' && row.level === 'supervisor');
    case 'kitchenMember':
      // A kitchen team member two levels under the head, so that the head of
      // kitchen is their N+2 and the second approval lands on him.
      return cast.find(
        (row) => row.department === 'KIT' && row.level === 'member' && row.managerManagerId !== null,
      );
    default:
      return undefined;
  }
}

/** A request was asked for a little before it starts, not the day it starts. */
function submittedAt(from: string): Date {
  const when = new Date(`${from}T09:00:00Z`);
  when.setUTCDate(when.getUTCDate() - 14);

  // Never in the future of the demo's own today.
  const today = new Date(`${TODAY}T09:00:00Z`);
  return when > today ? today : when;
}

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function plain(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 2) / 2;
}
