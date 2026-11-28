// Shifts, schedules and rest days (HR-02 build spec §3.2 and §3.4).
//
// INVENTED DATA ONLY (CLAUDE.md rule 6), and **every figure here is a demo
// value**: forty-four hours a week, the shift times, who rests on which day.
// None of it is law and none of it has been confirmed, which is why every row
// is seeded `confirmed: false` and says so on screen.
//
// What the data is for: the site's working week says what a *site* does, and
// these say what a *person* does. The outlet trades six days; nobody works six
// days. Without that distinction a request across somebody's rest day costs
// them a day they were never going to work.

import type { CPeoplePrismaClient } from '../client.js';

const DEMO_NOTE = 'Demo value, to be confirmed by SMG (HR-02 workshop).';

/**
 * The four shifts SMG described.
 *
 * The pastry shift starts at four in the morning, which is why night work is
 * not a theoretical question here: two of its hours are before six.
 */
const SHIFTS = [
  { code: 'MORNING', name: 'Morning', start: '07:00', end: '15:00', breakMinutes: 30 },
  { code: 'EVENING', name: 'Evening', start: '15:00', end: '23:00', breakMinutes: 30 },
  { code: 'SPLIT', name: 'Split', start: '10:00', end: '22:00', breakMinutes: 240 },
  { code: 'PASTRY', name: 'Pastry early', start: '04:00', end: '12:00', breakMinutes: 30 },
] as const;

/**
 * The four schedules, as the departments actually work.
 *
 * `days` is Sunday first, matching `SiteWorkWeek` and `Date.getUTCDay()`, so
 * that one numbering runs through the whole system.
 */
const SCHEDULES = [
  {
    code: 'OFFICE',
    name: 'Office week',
    weeklyHours: 44,
    // Monday to Friday, and Saturday morning.
    days: [false, true, true, true, true, true, true],
    shift: 'MORNING',
    departments: ['ADM', 'WAR'],
    restDay: 0,
  },
  {
    code: 'OUTLET',
    name: 'Outlet rota',
    weeklyHours: 44,
    // The outlet trades every day; each person rests on one of them.
    days: [true, true, true, true, true, true, true],
    shift: 'SPLIT',
    departments: ['OUT'],
    // Varies per person: spread across the week below.
    restDay: null,
  },
  {
    code: 'KITCHEN',
    name: 'Kitchen rota',
    weeklyHours: 44,
    days: [false, true, true, true, true, true, true],
    shift: 'MORNING',
    departments: ['KIT'],
    restDay: 0,
  },
  {
    code: 'PASTRY',
    name: 'Pastry early',
    weeklyHours: 44,
    days: [false, true, true, true, true, true, true],
    shift: 'PASTRY',
    departments: ['PAS'],
    restDay: 0,
  },
] as const;

/** Rest days the outlet spreads across its people, so the shop is never empty. */
const OUTLET_REST_DAYS = [0, 1, 2, 3, 0, 1, 2];

/** The schedules take effect at the start of the demo's year. */
const VALID_FROM = '2026-01-01';

/**
 * What an hour of overtime is worth (HR-02 build spec §5.6).
 *
 * **Not one of these rates is law.** They are the figures in the spec, seeded so
 * that the screens have something to show, and every row says it is waiting for
 * SMG and the payroll expert. The Labour Code article a tooltip may cite is
 * marked "to confirm" for the same reason.
 */
const OVERTIME_BANDS = [
  { bandCode: 'OT_DAY', dayType: 'working', timeFrom: '06:00', timeTo: '21:00', ratePercent: 25 },
  { bandCode: 'OT_NIGHT', dayType: 'working', timeFrom: '21:00', timeTo: '06:00', ratePercent: 50 },
  { bandCode: 'OT_REST_DAY', dayType: 'rest', timeFrom: '06:00', timeTo: '21:00', ratePercent: 50 },
  { bandCode: 'OT_REST_NIGHT', dayType: 'rest', timeFrom: '21:00', timeTo: '06:00', ratePercent: 100 },
  { bandCode: 'OT_REST_DAY', dayType: 'holiday', timeFrom: '06:00', timeTo: '21:00', ratePercent: 50 },
  { bandCode: 'OT_REST_NIGHT', dayType: 'holiday', timeFrom: '21:00', timeTo: '06:00', ratePercent: 100 },
] as const;

export interface ScheduleSeedCounts {
  readonly shifts: number;
  readonly schedules: number;
  readonly assigned: number;
  readonly overtimeBands: number;
}

/**
 * Per-company contribution rates (CLAUDE.md rule 3).
 *
 * Not legal values and not in the country pack: a CIMR rate is agreed between
 * one employer and the fund, so it is this company's figure and nobody else's.
 */
const CONTRIBUTION_RATES = [
  {
    code: 'CIMR_EE',
    rate: 0,
    note: 'SMG does not run CIMR today (spec CT05). Zero switches the line off rather than guessing a rate. To confirm.',
  },
  {
    code: 'CIMR_ER',
    rate: 0,
    note: 'SMG does not run CIMR today (spec CT05). Zero switches the line off rather than guessing a rate. To confirm.',
  },
] as const;

export async function seedHr02Schedules(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<ScheduleSeedCounts> {
  const shifts = new Map<string, string>();

  for (const shift of SHIFTS) {
    const row = await prisma.shiftPattern.create({
      data: {
        tenantId,
        code: shift.code,
        name: shift.name,
        start: shift.start,
        end: shift.end,
        breakMinutes: shift.breakMinutes,
        // A shift whose end is earlier than its start runs past midnight, and
        // belongs to the day it started.
        crossesMidnight: shift.end < shift.start,
        note: DEMO_NOTE,
        confirmed: false,
      },
    });

    shifts.set(shift.code, row.id);
  }

  const schedules = new Map<string, string>();

  for (const schedule of SCHEDULES) {
    const row = await prisma.workSchedule.create({
      data: {
        tenantId,
        code: schedule.code,
        name: schedule.name,
        weeklyHours: schedule.weeklyHours,
        note: DEMO_NOTE,
        confirmed: false,
      },
    });

    schedules.set(schedule.code, row.id);

    for (const [weekday, working] of schedule.days.entries()) {
      await prisma.workScheduleDay.create({
        data: {
          tenantId,
          scheduleId: row.id,
          weekday,
          working,
          ...(working ? { shiftPatternId: shifts.get(schedule.shift) } : {}),
        },
      });
    }
  }

  const employees = await prisma.employee.findMany({
    where: { tenantId },
    select: { id: true, employeeNumber: true, department: { select: { code: true } } },
    orderBy: { employeeNumber: 'asc' },
  });

  let assigned = 0;
  let outlet = 0;

  for (const employee of employees) {
    const code = employee.department?.code ?? '';
    const schedule = SCHEDULES.find((row) => (row.departments as readonly string[]).includes(code));

    if (!schedule) continue;

    const restDay =
      schedule.restDay === null
        ? (OUTLET_REST_DAYS[outlet++ % OUTLET_REST_DAYS.length] as number)
        : schedule.restDay;

    await prisma.employeeSchedule.create({
      data: {
        tenantId,
        employeeId: employee.id,
        scheduleId: schedules.get(schedule.code)!,
        weeklyRestDay: restDay,
        defaultShiftPatternId: shifts.get(schedule.shift),
        validFrom: new Date(`${VALID_FROM}T00:00:00Z`),
        note: DEMO_NOTE,
      },
    });

    assigned += 1;
  }

  for (const band of OVERTIME_BANDS) {
    await prisma.overtimeRule.create({
      data: {
        tenantId,
        bandCode: band.bandCode,
        dayType: band.dayType,
        timeFrom: band.timeFrom,
        timeTo: band.timeTo,
        ratePercent: band.ratePercent,
        effectiveFrom: new Date(`${VALID_FROM}T00:00:00Z`),
        note: DEMO_NOTE,
        confirmed: false,
      },
    });
  }

  await prisma.overtimeSettings.create({
    data: {
      tenantId,
      // Both thresholds, without counting the same hour twice; rounding up, in
      // the employee's favour. Every one of these is a question for SMG.
      thresholdMode: 'both',
      normalWeeklyHours: 44,
      normalDailyHours: 8,
      roundingMinutes: 15,
      roundingDirection: 'up',
      latenessToleranceMin: 10,
      dailyMaxHours: 12,
      // An hour for an hour, until SMG says otherwise: the smaller promise, and
      // the one that is easiest to increase later (HR-02 open point 18).
      recoveryRatio: 1,
      note: DEMO_NOTE,
      confirmed: false,
    },
  });

  // The company's own contribution rates, which are not law and do not belong
  // in the country pack (CLAUDE.md rule 3). SMG does not run CIMR today — the
  // spec says so (CT05) — so both rates are seeded at zero, which switches the
  // lines off in the engine without pretending to know a figure. A company that
  // does run it enters its own, agreed with the fund.
  for (const rate of CONTRIBUTION_RATES) {
    await prisma.tenantContributionRate.create({
      data: {
        tenantId,
        code: rate.code,
        rate: rate.rate,
        effectiveFrom: new Date(`${VALID_FROM}T00:00:00Z`),
        note: rate.note,
        confirmed: false,
        createdBy: 'seed',
      },
    });
  }

  return {
    shifts: SHIFTS.length,
    schedules: SCHEDULES.length,
    assigned,
    overtimeBands: OVERTIME_BANDS.length,
  };
}

/** Everything this seeder owns. */
export async function clearHr02Schedules(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<void> {
  const where = { tenantId };

  await prisma.attendanceException.deleteMany({ where });
  await prisma.workDay.deleteMany({ where });
  await prisma.punch.deleteMany({ where });
  await prisma.attendanceImport.deleteMany({ where });
  await prisma.employeeNumberAlias.deleteMany({ where });
  await prisma.tenantContributionRate.deleteMany({ where });
  await prisma.overtimeRule.deleteMany({ where });
  await prisma.overtimeSettings.deleteMany({ where });
  await prisma.shiftAssignment.deleteMany({ where });
  await prisma.employeeSchedule.deleteMany({ where });
  await prisma.workScheduleDay.deleteMany({ where });
  await prisma.workSchedule.deleteMany({ where });
  await prisma.shiftPattern.deleteMany({ where });
}
