// Leave set-up for the demo tenant: types, the rules behind them, the working
// week of each site, and the public holidays (M08 / HR-04).
//
// INVENTED DATA ONLY (CLAUDE.md rule 6), and more than that: **not one number
// here is a legal value** (rule 3). Moroccan labour law and SMG's own agreement
// decide what annual leave is worth, how it accrues and how much carries over,
// and neither of them has told us yet. So every rule row is seeded with a
// plausible demo figure, a note saying exactly that, and `confirmed = false`,
// which the screens show as "to be confirmed".
//
// The open questions are written down in docs/specs/HR-02-open-points.md for the
// SMG HR workshop.

import type { CPeoplePrismaClient } from '../client.js';

/** What the demo's leave year looks like, until SMG says otherwise. */
const DEMO_NOTE = 'Demo value, to be confirmed by the payroll expert (HR-02 workshop).';

/** The rules take effect at the start of the demo's leave year. */
const EFFECTIVE_FROM = '2026-01-01';

/**
 * The seven kinds of absence SMG named, plus the free "other".
 *
 * Every switch on a row is a question the client answers, which is why they are
 * columns and not conditions in code: paid or not, counted in working days or
 * calendar days, needing a certificate, needing the manager's manager.
 */
const LEAVE_TYPES = [
  {
    code: 'ANNUAL',
    name: 'Congé annuel',
    paid: true,
    requiresDocument: false,
    dayBasis: 'working',
    allowsHalfDays: true,
    requiresSecondApproval: false,
    tracksBalance: true,
    rule: {
      entitlementDays: 18,
      accrualPerMonth: 1.5,
      carryOverMaxDays: 18,
      // What happens to days left at the end of the year, and how long carried
      // days last. Both demo values: SMG and the payroll expert decide
      // (HR-02 open points 1 and 15).
      carryOverMode: 'limited',
      carryOverExpiryMonths: 6,
      minNoticeDays: 7,
      maxBackdateDays: 0,
    },
  },
  {
    code: 'SICK',
    name: 'Congé maladie',
    paid: true,
    requiresDocument: true,
    dayBasis: 'calendar',
    allowsHalfDays: true,
    requiresSecondApproval: false,
    tracksBalance: false,
    // Sick leave is always after the fact, so it is the one type that may be
    // dated backwards.
    rule: { minNoticeDays: 0, maxBackdateDays: 30 },
  },
  {
    code: 'UNPAID',
    name: 'Congé sans solde',
    paid: false,
    requiresDocument: false,
    dayBasis: 'working',
    allowsHalfDays: true,
    // Unpaid leave costs the company nothing and the employee a month's pay, so
    // it goes up the line (HR-02 open point 2).
    requiresSecondApproval: true,
    tracksBalance: false,
    rule: { minNoticeDays: 14, maxBackdateDays: 0 },
  },
  {
    code: 'MATERNITY',
    name: 'Congé de maternité',
    paid: true,
    requiresDocument: true,
    dayBasis: 'calendar',
    allowsHalfDays: false,
    requiresSecondApproval: false,
    tracksBalance: false,
    rule: { minNoticeDays: 0, maxBackdateDays: 7 },
  },
  {
    code: 'PATERNITY',
    name: 'Congé de paternité',
    paid: true,
    requiresDocument: true,
    dayBasis: 'calendar',
    allowsHalfDays: false,
    requiresSecondApproval: false,
    tracksBalance: false,
    rule: { minNoticeDays: 0, maxBackdateDays: 7 },
  },
  {
    code: 'EXCEPTIONAL',
    name: 'Congé exceptionnel',
    paid: true,
    requiresDocument: true,
    dayBasis: 'working',
    allowsHalfDays: false,
    requiresSecondApproval: true,
    tracksBalance: false,
    rule: { minNoticeDays: 0, maxBackdateDays: 7 },
  },
  {
    code: 'OTHER',
    name: 'Autre absence',
    paid: false,
    requiresDocument: false,
    dayBasis: 'working',
    allowsHalfDays: true,
    requiresSecondApproval: false,
    tracksBalance: false,
    rule: { minNoticeDays: 0, maxBackdateDays: 0 },
  },
] as const;

/**
 * Which days each site works.
 *
 * The outlet trades on Saturday and the rest of the company does not, which is
 * the whole reason this is per site: "Monday to Sunday" is five days for the
 * head office and six for the outlet.
 */
const WORK_WEEKS = [
  { site: 'OUTLET', workingDays: [1, 2, 3, 4, 5, 6] },
  { site: 'HEAD', workingDays: [1, 2, 3, 4, 5] },
  { site: 'KITCHEN', workingDays: [1, 2, 3, 4, 5] },
  { site: 'PASTRY', workingDays: [1, 2, 3, 4, 5] },
  { site: 'WAREHOUSE', workingDays: [1, 2, 3, 4, 5] },
] as const;

/**
 * Morocco's **fixed** national holidays for 2026 and 2027.
 *
 * Only the fixed ones. The religious holidays — Aid Al Fitr, Aid Al Adha, Fatih
 * Muharram, Aid Al Mawlid — move with the lunar calendar and are announced by
 * the authorities, so this file does not guess them and the application never
 * calculates them: somebody enters them, per year, on the holidays screen. A
 * wrong date here would quietly change how many days every request costs.
 *
 * Every row is unconfirmed until SMG checks the list.
 */
const PUBLIC_HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-11', name: 'Proclamation of Independence' },
  { date: '2026-01-14', name: 'Amazigh New Year' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-07-30', name: 'Throne Day' },
  { date: '2026-08-14', name: 'Oued Ed-Dahab Day' },
  { date: '2026-08-20', name: 'Revolution of the King and the People' },
  { date: '2026-08-21', name: 'Youth Day' },
  { date: '2026-11-06', name: 'Green March Day' },
  { date: '2026-11-18', name: 'Independence Day' },
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-01-11', name: 'Proclamation of Independence' },
  { date: '2027-01-14', name: 'Amazigh New Year' },
  { date: '2027-05-01', name: 'Labour Day' },
  { date: '2027-07-30', name: 'Throne Day' },
  { date: '2027-08-14', name: 'Oued Ed-Dahab Day' },
  { date: '2027-08-20', name: 'Revolution of the King and the People' },
  { date: '2027-08-21', name: 'Youth Day' },
  { date: '2027-11-06', name: 'Green March Day' },
  { date: '2027-11-18', name: 'Independence Day' },
] as const;

const HOLIDAY_NOTE =
  'National fixed holiday, to confirm with SMG. Moveable religious holidays are entered per year.';

export interface LeaveSeedCounts {
  readonly leaveTypes: number;
  readonly leaveRules: number;
  readonly workWeeks: number;
  readonly holidays: number;
}

/**
 * Seeds the leave set-up for one tenant.
 *
 * Called after the sites exist, because the working week hangs off them.
 */
export async function seedHr02Leave(
  prisma: CPeoplePrismaClient,
  tenantId: string,
  sites: ReadonlyMap<string, string>,
): Promise<LeaveSeedCounts> {
  await prisma.leaveSettings.create({
    data: {
      tenantId,
      // More than a third of a department off on one day is worth a warning, and
      // never more than a warning (HR-02 open point 6).
      teamOffWarningPercent: 33,
      leaveYearStart: '01-01',
      // Where a request with nobody above the requester is sent. A team address,
      // so that it survives somebody leaving (HR-02 open point 11).
      hrEmail: 'hr@smg-demo.test',
      note: DEMO_NOTE,
    },
  });

  let leaveRules = 0;

  for (const [index, type] of LEAVE_TYPES.entries()) {
    const row = await prisma.leaveType.create({
      data: {
        tenantId,
        code: type.code,
        name: type.name,
        paid: type.paid,
        requiresDocument: type.requiresDocument,
        dayBasis: type.dayBasis,
        allowsHalfDays: type.allowsHalfDays,
        requiresSecondApproval: type.requiresSecondApproval,
        tracksBalance: type.tracksBalance,
        sortOrder: index,
      },
    });

    const rule = type.rule as {
      entitlementDays?: number;
      accrualPerMonth?: number;
      carryOverMaxDays?: number;
      carryOverMode?: 'all' | 'limited' | 'none';
      carryOverExpiryMonths?: number;
      minNoticeDays: number;
      maxBackdateDays: number;
    };

    await prisma.leaveRule.create({
      data: {
        tenantId,
        leaveTypeId: row.id,
        effectiveFrom: day(EFFECTIVE_FROM),
        ...(rule.entitlementDays === undefined ? {} : { entitlementDays: rule.entitlementDays }),
        ...(rule.accrualPerMonth === undefined ? {} : { accrualPerMonth: rule.accrualPerMonth }),
        ...(rule.carryOverMaxDays === undefined ? {} : { carryOverMaxDays: rule.carryOverMaxDays }),
        // Types with nothing to carry say so, rather than leaving the default
        // to decide for them.
        carryOverMode: rule.carryOverMode ?? 'none',
        ...(rule.carryOverExpiryMonths === undefined
          ? {}
          : { carryOverExpiryMonths: rule.carryOverExpiryMonths }),
        minNoticeDays: rule.minNoticeDays,
        maxBackdateDays: rule.maxBackdateDays,
        note: DEMO_NOTE,
        confirmed: false,
      },
    });
    leaveRules += 1;
  }

  let workWeeks = 0;

  for (const week of WORK_WEEKS) {
    const siteId = sites.get(week.site);
    if (!siteId) continue;

    await prisma.siteWorkWeek.create({
      data: {
        tenantId,
        siteId,
        workingDays: [...week.workingDays],
        effectiveFrom: day(EFFECTIVE_FROM),
        note: DEMO_NOTE,
        confirmed: false,
      },
    });
    workWeeks += 1;
  }

  await prisma.publicHoliday.createMany({
    data: PUBLIC_HOLIDAYS.map((holiday) => ({
      tenantId,
      countryCode: 'MA',
      date: day(holiday.date),
      name: holiday.name,
      confirmed: false,
      note: HOLIDAY_NOTE,
    })),
  });

  // 2026's list is finished; 2027's is not, because the moveable religious
  // holidays for next year have not been announced. That difference is the
  // point: a request falling in 2027 says its count may still move.
  await prisma.publicHolidayYear.createMany({
    data: [
      { tenantId, countryCode: 'MA', year: 2026, complete: true, completedAt: new Date(), completedBy: 'Demo seed' },
      { tenantId, countryCode: 'MA', year: 2027, complete: false },
    ],
  });

  return {
    leaveTypes: LEAVE_TYPES.length,
    leaveRules,
    workWeeks,
    holidays: PUBLIC_HOLIDAYS.length,
  };
}

/** Everything this seeder owns, for "Reset demo data". */
export async function clearHr02Leave(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<void> {
  const where = { tenantId };

  await prisma.leaveRule.deleteMany({ where });
  await prisma.leaveType.deleteMany({ where });
  await prisma.siteWorkWeek.deleteMany({ where });
  await prisma.leaveSettings.deleteMany({ where });
  await prisma.publicHoliday.deleteMany({ where });
}

/** A plain date at UTC midnight: a day, not an instant. */
function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
