import { calculate, type CalculationResult, type VariableLine } from '@cpeople/payroll-engine';
import { describe, expect, it } from 'vitest';

import { loadMoroccoPack } from '../src/index.js';

/**
 * Golden payslips (spec §12, §18). Each expected figure is to the cent, worked
 * out by hand from the rules in the spec — G01 also matches a published 2026
 * worked example. They prove the engine applies the pack as written; they do
 * not prove the rates are right. That is the payroll expert's sign-off (O3),
 * which is why every case runs in simulation mode.
 *
 * TODO(verify-official-rate): rerun and re-sign every case once the parameter
 * rows are verified.
 */
const pack = loadMoroccoPack();

function run(inputs: Record<string, string>, variables: VariableLine[] = [], asOf = '2026-11-30'): CalculationResult {
  return calculate({ pack, asOf, periodId: asOf.slice(0, 7), employee: { employeeId: 'golden', inputs, variables }, mode: 'simulation' });
}
const amount = (r: CalculationResult, code: string): string | undefined => r.lines.find((l) => l.code === code)?.amount;

describe('M12 Morocco golden payslips (simulation, unverified rates)', () => {
  it('G01 — 10,000 base, no seniority, 3 dependents', () => {
    const r = run({ MONTHLY_SALARY: '10000', TAX_DEPENDENTS: '3' });
    expect(r.status).toBe('calculated');
    expect(amount(r, '5100')).toBe('268.80');
    expect(amount(r, '5110')).toBe('226.00');
    expect(amount(r, '9010')).toBe('2500.00');
    expect(amount(r, '9020')).toBe('7005.20');
    expect(amount(r, '9030')).toBe('601.56');
    expect(amount(r, '9040')).toBe('150.00');
    expect(amount(r, '5200')).toBe('451.56');
    expect(r.totals.net).toBe('9053.64');
    expect(r.totals.employer).toBe('1749.80');
  });

  it('G02 — 4,200 base, 3 years of service (5%), no dependents', () => {
    const r = run({ MONTHLY_SALARY: '4200', SERVICE_YEARS: '3' });
    expect(amount(r, '1100')).toBe('210.00');
    expect(r.bases.GROSS).toBe('4410.00');
    expect(amount(r, '5100')).toBe('197.57');
    expect(amount(r, '5110')).toBe('99.67');
    expect(amount(r, '9010')).toBe('1543.50');
    expect(amount(r, '9020')).toBe('2569.26');
    expect(amount(r, '5200')).toBe('0.00');
    expect(r.totals.net).toBe('4112.76');
    expect(r.totals.employer).toBe('930.07');
  });

  it('G03 — 14,000 base, 7 years (10%), 2 dependents: ceiling on CNSS and on professional expenses', () => {
    const r = run({ MONTHLY_SALARY: '14000', SERVICE_YEARS: '7', TAX_DEPENDENTS: '2' });
    expect(r.bases.GROSS).toBe('15400.00');
    expect(amount(r, '5100')).toBe('268.80');
    expect(amount(r, '5110')).toBe('348.04');
    expect(amount(r, '9010')).toBe('2916.67');
    expect(amount(r, '9020')).toBe('11866.49');
    // Annual scale on 12 × the month, ÷ 12. A monthly table with deductions
    // rounded to 1,833.33 gives 2,201.28: the method is to validate (spec §12).
    expect(amount(r, '9030')).toBe('2201.27');
    expect(amount(r, '5200')).toBe('2101.27');
    expect(r.totals.net).toBe('12681.89');
    expect(r.totals.employer).toBe('2403.74');
  });

  it('G04 — minimum wage, full month', () => {
    const r = run({ MONTHLY_SALARY: '3422.72' });
    expect(r.status).toBe('calculated');
    expect(amount(r, '5100')).toBe('153.34');
    expect(amount(r, '5110')).toBe('77.35');
    expect(amount(r, '5200')).toBe('0.00');
    expect(r.totals.net).toBe('3192.03');
    expect(r.totals.employer).toBe('721.84');
  });

  it('G05 — mid-month hire: 13 of 26 days', () => {
    const r = run({ MONTHLY_SALARY: '8000', DAYS_PAID: '13' });
    expect(amount(r, '1000')).toBe('4000.00');
    expect(r.checks).toEqual([]);
  });

  it('G06 — overtime: hourly = (salary + seniority) ÷ 191, premium from the tenant rule', () => {
    const r = run({ MONTHLY_SALARY: '4775', SERVICE_YEARS: '0', OT_DAY_HOURS: '4', OT_DAY_PREMIUM: '0.25', OT_NIGHT_HOURS: '2', OT_NIGHT_PREMIUM: '0.50' });
    // 4,775 ÷ 191 = 25.00 an hour.
    expect(amount(r, '1200')).toBe('125.00');
    expect(amount(r, '1210')).toBe('75.00');
    expect(r.bases.SOCIAL).toBe('4975.00');
  });

  it('G07 — company elements: a taxable commission, an advance, an expense reimbursement', () => {
    const r = run({ MONTHLY_SALARY: '6000' }, [
      { code: 'COMMISSION', label: { en: 'Commission', fr: 'Commission' }, treatmentClass: 'MA_TAXABLE', amount: '1000' },
      { code: 'ADVANCE', label: { en: 'Salary advance', fr: 'Avance sur salaire' }, treatmentClass: 'MA_DEDUCTION', amount: '500' },
      { code: 'EXPENSES', label: { en: 'Expenses', fr: 'Notes de frais' }, treatmentClass: 'MA_REIMBURSEMENT', amount: '350' },
    ]);
    expect(r.bases.GROSS).toBe('7000.00');
    expect(r.bases.SOCIAL).toBe('7000.00');
    const deductions = ['5100', '5110', '5200', 'ADVANCE'].map((c) => Number(amount(r, c) ?? '0'));
    expect(r.totals.net).toBe((7000 - deductions.reduce((a, b) => a + b, 0) + 350).toFixed(2));
  });

  it('G08 — seven dependents count as six', () => {
    const r = run({ MONTHLY_SALARY: '20000', TAX_DEPENDENTS: '7' });
    expect(amount(r, '9040')).toBe('300.00');
    expect(r.checks.map((c) => c.id)).toEqual(['DEPENDENTS_CAPPED']);
  });

  it('G09 — the 2025 family deduction applies to a 2025 period', () => {
    const r = run({ MONTHLY_SALARY: '10000', TAX_DEPENDENTS: '3' }, [], '2025-12-31');
    // 500 a year per dependent in 2025: 3 × 500 ÷ 12 = 125.00.
    expect(amount(r, '9040')).toBe('125.00');
  });

  it('blocks a salary below the minimum wage, and blocks production on unverified rates', () => {
    expect(run({ MONTHLY_SALARY: '3000' }).status).toBe('blocked');
    const prod = calculate({ pack, asOf: '2026-11-30', periodId: '2026-11', employee: { employeeId: 'x', inputs: { MONTHLY_SALARY: '10000' } }, mode: 'production' });
    expect(prod.status).toBe('blocked');
    expect(prod.checks.at(-1)?.id).toBe('UNVERIFIED_PARAMETERS');
  });
});

describe('M27 Morocco pack as data', () => {
  it('is a prototype: payroll allowed in Dev & Test as a specimen, refused in production', async () => {
    const { payrollAllowed } = await import('@cpeople/payroll-engine');
    expect(payrollAllowed(pack, 'test')).toEqual({ allowed: true, specimen: true });
    expect(payrollAllowed(pack, 'prod').allowed).toBe(false);
  });

  it('marks every legal value as unverified, with a source', () => {
    for (const row of pack.payroll!.parameters) {
      expect(row.status).toBe('unverified');
      expect(row.source).toMatch(/TODO\(verify-official-rate\)/);
    }
  });

  it('G10 — CIMR at a rate the company agreed, not one the pack knows', () => {
    // CIMR is a **per-company** rate (CLAUDE.md rule 3): it is agreed between
    // one employer and the fund, so it is an input and there is no row for it
    // in this pack. It comes from `tenant_contribution_rate`, effective-dated
    // per tenant, and six per cent here is this test's figure and nobody's law.
    //
    // Both lines are the social base times the rate, so they are worked out by
    // hand: the social base of a 10,000 salary with no seniority is 10,000
    // (AMO EE of 226.00 at 0.0226 says so in G01), and 10,000 x 0.06 is 600.00.
    const r = run({ MONTHLY_SALARY: '10000', CIMR_EE_RATE: '0.06', CIMR_ER_RATE: '0.06' });

    expect(r.status).toBe('calculated');
    expect(amount(r, '5120')).toBe('600.00');
    expect(amount(r, '7140')).toBe('600.00');

    // And it reaches what the company pays. Without CIMR the employer side of a
    // 10,000 salary is 1,749.80 (G01); the employer's six per cent adds exactly
    // its own 600.00 on top.
    expect(r.totals.employer).toBe('2349.80');
  });

  it('G11 — no CIMR line at all when the company does not run it', () => {
    // Which is SMG today (spec CT05), and is how the demo tenant is seeded: the
    // rate rows exist at zero rather than being absent, so the answer to "does
    // this company run CIMR" is a row somebody can read and change, not a gap.
    const r = run({ MONTHLY_SALARY: '10000', CIMR_EE_RATE: '0', CIMR_ER_RATE: '0' });

    expect(amount(r, '5120')).toBeUndefined();
    expect(amount(r, '7140')).toBeUndefined();
    expect(r.totals.employer).toBe('1749.80');
  });
});
