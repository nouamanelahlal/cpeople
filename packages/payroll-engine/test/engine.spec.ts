import { describe, expect, it } from 'vitest';

import { calculate, type CalculationRequest } from '../src/engine.js';
import { payrollAllowed } from '../src/pack.js';
import { fictionalPack } from './fixture.js';

const request = (over: Partial<CalculationRequest> = {}, inputs: Record<string, string> = { SALARY: '2000' }): CalculationRequest => ({
  pack: fictionalPack(),
  asOf: '2026-03-31',
  periodId: '2026-03',
  employee: { employeeId: 'e1', inputs },
  mode: 'simulation',
  ...over,
});

describe('payroll engine (M12, M13; spec §11)', () => {
  it('runs the schema in order with exact bases', () => {
    const r = calculate(request());
    expect(r.status).toBe('calculated');
    expect(r.lines.map((l) => [l.code, l.amount])).toEqual([
      ['BASE', '2000.00'],
      ['SOC', '100.00'],
      ['TAX', '280.00'],
      ['NET', '1620.00'],
    ]);
    expect(r.bases).toMatchObject({ GROSS: '2000.00', SOCIAL: '2000.00', TAXABLE: '1900.00', DEDUCTIONS: '380.00' });
    expect(r.totals).toMatchObject({ earnings: '2000.00', deductions: '380.00', net: '1620.00' });
  });

  it('prorates and warns on a short month', () => {
    const r = calculate(request({}, { SALARY: '2000', DAYS: '13' }));
    expect(r.lines[0]).toMatchObject({ code: 'BASE', amount: '1300.00' });
    expect(r.checks.map((c) => c.id)).toEqual(['SHORT']);
  });

  it('blocks before calculating when a block check fires', () => {
    const r = calculate(request({}, { SALARY: '0' }));
    expect(r.status).toBe('blocked');
    expect(r.lines).toEqual([]);
    expect(r.totals.net).toBe('0.00');
  });

  it('reads the parameter row in force on the date', () => {
    const july = calculate(request({ asOf: '2026-07-31', periodId: '2026-07' }));
    expect(july.lines.find((l) => l.code === 'SOC')?.amount).toBe('120.00');
    expect(july.unverifiedParameters).toEqual(['RATE']);
  });

  it('refuses unverified legal values in production (CP-PCK-004)', () => {
    const r = calculate(request({ asOf: '2026-07-31', periodId: '2026-07', mode: 'production' }));
    expect(r.status).toBe('blocked');
    expect(r.checks.at(-1)?.id).toBe('UNVERIFIED_PARAMETERS');
    expect(calculate(request({ mode: 'production' })).status).toBe('calculated');
  });

  it('splits an exempt allowance at its ceiling', () => {
    const r = calculate({
      ...request(),
      employee: {
        employeeId: 'e1',
        inputs: { SALARY: '2000' },
        variables: [{ code: 'MEAL', label: { en: 'Meal', fr: 'Panier' }, treatmentClass: 'EXEMPT_MEAL', amount: '80' }],
      },
    });
    expect(r.lines.filter((l) => l.code.startsWith('MEAL')).map((l) => [l.code, l.amount])).toEqual([
      ['MEAL', '50.00'],
      ['MEAL.TAXABLE', '30.00'],
    ]);
    expect(r.bases.GROSS).toBe('2080.00');
    expect(r.bases.SOCIAL).toBe('2030.00');
  });

  it('explains every line', () => {
    const soc = calculate(request()).lines.find((l) => l.code === 'SOC')!;
    expect(soc.trace.formula).toContain("param('RATE')");
    expect(soc.trace.parameters.map((p) => p.key).sort()).toEqual(['CEILING', 'RATE']);
    expect(soc.rate).toBe('0.100000');
  });

  it('is deterministic and fingerprints its inputs (CP-PAY-005)', () => {
    const a = calculate(request());
    const b = calculate(request());
    expect(a).toEqual(b);
    expect(calculate(request({}, { SALARY: '2001' })).inputHash).not.toBe(a.inputHash);
  });

  it('refuses inputs the pack does not declare', () => {
    expect(() => calculate(request({}, { SALARY: '1', BONUS: '5' }))).toThrow(/not declared/);
    expect(() => calculate(request({}, {}))).toThrow(/required/);
  });
});

describe('payroll allowed by pack status (spec §7)', () => {
  it('lets a prototype run outside production only, as a specimen', () => {
    const pack = fictionalPack();
    expect(payrollAllowed(pack, 'test')).toEqual({ allowed: true, specimen: true });
    expect(payrollAllowed(pack, 'prod').allowed).toBe(false);
    const placeholder = { ...pack, manifest: { ...pack.manifest, status: 'placeholder' as const } };
    expect(payrollAllowed(placeholder, 'local').allowed).toBe(false);
  });
});
