// Opening balances, adjustments and the payroll months behind them (M09 / M10).
//
// INVENTED DATA ONLY (CLAUDE.md rule 6). Three small things, each of which makes
// a screen tell the truth rather than a row of zeroes:
//
//   * an **opening balance** for everybody, as at 31 December 2025 — what people
//     brought with them from whatever SMG used before. Without it a balance
//     screen in November would show only what this system has watched accrue.
//   * two **adjustments** on the named cast, so the history of a balance has
//     something in it and the reason beside each one is visible.
//   * the **payroll months**: October 2026 locked and November 2026 open, which
//     is what makes "a change to a closed month becomes a correction" something
//     the demo can actually show (HR-02 open point 13).
//
// The opening figures are deterministic — the same seed gives the same company
// every time — and none of them is a legal entitlement: what somebody is owed
// is a rule row, and every rule row says it is waiting for the payroll expert.

import type { CPeoplePrismaClient } from '../client.js';

/**
 * The day the demo's opening balances are true as at (HR-02 build spec §3.4).
 *
 * Inside the current leave year, deliberately: a company that moves to CPeople
 * in November brings a balance as at the day before, and everything after it is
 * earned here. The balance service accrues from the day after this one, so the
 * same months are never counted twice.
 */
const BALANCE_AT = '2026-10-31';

/** The payroll months the demo knows about (HR-03 takes this table over). */
const PAYROLL_MONTHS = [
  { month: '2026-09', status: 'locked' as const },
  { month: '2026-10', status: 'locked' as const },
  { month: '2026-11', status: 'open' as const },
];

/** Adjustments on people the demo script names, so a history has a story. */
const ADJUSTMENTS = [
  {
    number: '1003',
    code: 'ANNUAL',
    days: -1,
    on: '2026-09-14',
    reason: 'Day taken in August recorded late; agreed with the employee.',
  },
  {
    number: '1008',
    code: 'ANNUAL',
    days: 2,
    on: '2026-10-05',
    reason: 'Two days returned after the September rota change.',
  },
];

export interface BalanceSeedCounts {
  readonly openingBalances: number;
  readonly adjustments: number;
  readonly payrollMonths: number;
}

/**
 * Seeds the balances behind the leave screens.
 *
 * Called after the people and the leave set-up exist, because every row hangs
 * off both.
 */
export async function seedHr02Balances(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<BalanceSeedCounts> {
  for (const period of PAYROLL_MONTHS) {
    await prisma.payrollPeriod.create({
      data: {
        tenantId,
        month: period.month,
        status: period.status,
        ...(period.status === 'locked'
          ? { lockedAt: new Date(`${period.month}-28T18:00:00Z`), lockedBy: 'Demo seed' }
          : {}),
      },
    });
  }

  const annual = await prisma.leaveType.findFirst({ where: { tenantId, code: 'ANNUAL' } });
  if (!annual) {
    return { openingBalances: 0, adjustments: 0, payrollMonths: PAYROLL_MONTHS.length };
  }

  const employees = await prisma.employee.findMany({
    where: { tenantId },
    select: { id: true, employeeNumber: true, hireDate: true },
    orderBy: { employeeNumber: 'asc' },
  });

  let openingBalances = 0;

  for (const employee of employees) {
    // Somebody hired this year brought nothing with them: their balance starts
    // when they do.
    if (employee.hireDate >= new Date(`${BALANCE_AT}T00:00:00Z`)) continue;

    await prisma.leaveOpeningBalance.create({
      data: {
        tenantId,
        employeeId: employee.id,
        leaveTypeId: annual.id,
        days: openingFor(employee.employeeNumber),
        balanceAt: new Date(`${BALANCE_AT}T00:00:00Z`),
        note: 'Brought over from the previous system (demo data).',
        createdBy: 'Demo seed',
        createdRole: 'hr',
      },
    });

    openingBalances += 1;
  }

  let adjustments = 0;

  for (const entry of ADJUSTMENTS) {
    const employee = employees.find((row) => row.employeeNumber === entry.number);
    if (!employee) continue;

    await prisma.leaveBalanceAdjustment.create({
      data: {
        tenantId,
        employeeId: employee.id,
        leaveTypeId: annual.id,
        days: entry.days,
        reason: entry.reason,
        effectiveOn: new Date(`${entry.on}T00:00:00Z`),
        createdBy: 'Salma Benali',
        createdRole: 'hr',
      },
    });

    adjustments += 1;
  }

  return { openingBalances, adjustments, payrollMonths: PAYROLL_MONTHS.length };
}

/** Everything this seeder owns. */
export async function clearHr02Balances(
  prisma: CPeoplePrismaClient,
  tenantId: string,
): Promise<void> {
  const where = { tenantId };

  await prisma.leaveCarryOver.deleteMany({ where });
  await prisma.leaveCarryOverRun.deleteMany({ where });
  await prisma.leaveBalanceAdjustment.deleteMany({ where });
  await prisma.leaveOpeningBalance.deleteMany({ where });
  await prisma.leaveCorrection.deleteMany({ where });
  await prisma.payrollPeriod.deleteMany({ where });
}

/**
 * A plausible opening balance, decided by the employee number.
 *
 * Deterministic on purpose: the demo's figures have to be the same every time
 * it is reset, or a rehearsed script stops matching the screen.
 */
function openingFor(employeeNumber: string): number {
  const digits = Number(employeeNumber.replace(/\D/g, '')) || 1;

  // Between 0 and 11.5 days, in halves: a year's accrual is 18, and people
  // arrive in November with most of theirs still to take.
  return ((digits * 7) % 24) / 2;
}
