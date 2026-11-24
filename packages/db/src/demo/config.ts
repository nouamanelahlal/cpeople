// The shape of the demo company, in one place (HR-02 build spec §3.4).
//
// Separated from the seed itself because it is the part somebody changes: a
// headcount, a contract mix, the day the demo is set on. The generator reads
// this and produces the same company every time.
//
// INVENTED DATA ONLY (CLAUDE.md rule 6).

/** The day the demo is set on. Everything in the seed is written around it. */
export const DEMO_TODAY = '2026-11-24';

/**
 * Forty-four people, as SMG confirmed at the HR-01 workshop.
 *
 * The order matters: Outlet first, because the outlet is where the attendance
 * devices are and where the demo spends its time.
 */
export const DEPARTMENTS = [
  { code: 'OUT', name: 'Outlet', headcount: 14, site: 'OUTLET', costCentre: 'CC-OUT', supervisors: 2 },
  { code: 'KIT', name: 'Kitchen', headcount: 12, site: 'KITCHEN', costCentre: 'CC-KIT', supervisors: 2 },
  { code: 'PAS', name: 'Pastry', headcount: 8, site: 'PASTRY', costCentre: 'CC-PAS', supervisors: 1 },
  { code: 'ADM', name: 'Administration', headcount: 6, site: 'HEAD', costCentre: 'CC-ADM', supervisors: 1 },
  { code: 'WAR', name: 'Warehouse', headcount: 4, site: 'WAREHOUSE', costCentre: 'CC-WAR', supervisors: 0 },
] as const;

export const HEADCOUNT = DEPARTMENTS.reduce((sum, row) => sum + row.headcount, 0);

/**
 * Employee numbers.
 *
 * Decision 2 of the HR-01 minutes: the employee number **is** the biometric
 * device id, and it is what an attendance file is matched on. So it is a plain
 * number rather than the old "SMG-0001" — a turnstile does not know about
 * prefixes.
 */
export const EMPLOYEE_NUMBER_FROM = 1001;

/** How many of each kind of contract. 38 + 4 + 2 = 44. */
export const CONTRACT_MIX = { CDI: 38, CDD: 4, ANAPEC: 2 } as const;

/**
 * The shape of the service history.
 *
 * Annual leave accrues with seniority, so a demo that is all five-year veterans
 * cannot show the seniority line and one that is all new starters cannot show a
 * balance. These are the people the workshop will look at.
 */
export const SENIORITY = {
  /** At least this many with more than ten years. */
  overTenYears: 1,
  /** At least this many with more than five. */
  overFiveYears: 3,
  /** At least this many hired within the last six months. */
  underSixMonths: 2,
} as const;

/** The default format of an employee number: digits, up to ten of them. */
export const EMPLOYEE_NUMBER_PATTERN = String.raw`^\d{1,10}$`;
