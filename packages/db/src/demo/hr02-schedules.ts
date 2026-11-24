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

export interface ScheduleSeedCounts {
  readonly shifts: number;
  readonly schedules: number;
  readonly assigned: number;
}

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

  return { shifts: SHIFTS.length, schedules: SCHEDULES.length, assigned };
}

/** Everything this seeder owns. */
export async function clearHr02Schedules(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<void> {
  const where = { tenantId };

  await prisma.shiftAssignment.deleteMany({ where });
  await prisma.employeeSchedule.deleteMany({ where });
  await prisma.workScheduleDay.deleteMany({ where });
  await prisma.workSchedule.deleteMany({ where });
  await prisma.shiftPattern.deleteMany({ where });
}
