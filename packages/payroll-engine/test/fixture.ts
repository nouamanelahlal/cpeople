import type { CountryPack } from '../src/pack.js';

/**
 * A fictional country, "ZZ", for testing the engine. Every rate here is made up
 * and belongs to no real country: the engine must work without knowing one.
 */
export function fictionalPack(): CountryPack {
  return {
    format: 'cpeople-country-pack/1',
    manifest: {
      country: 'ZZ',
      name: { en: 'Fictional', fr: 'Fictif' },
      version: '2026.1.0',
      status: 'prototype',
      currency: 'ZZD',
      minorUnits: 2,
      defaultLanguage: 'en',
      modules: ['core', 'payroll'],
      lawBasis: ['None: test fixture'],
      owner: 'tests',
    },
    payroll: {
      inputs: [
        { key: 'SALARY', label: { en: 'Salary', fr: 'Salaire' } },
        { key: 'DAYS', label: { en: 'Days paid', fr: 'Jours payés' }, default: '20' },
      ],
      parameters: [
        { key: 'DIVISOR', type: 'decimal', value: '20', validFrom: '2026-01-01', status: 'verified', source: 'fixture', verifiedBy: 'tests', verifiedOn: '2026-01-01' },
        { key: 'CEILING', type: 'decimal', value: '1000', validFrom: '2026-01-01', status: 'verified', source: 'fixture', verifiedBy: 'tests', verifiedOn: '2026-01-01' },
        { key: 'RATE', type: 'decimal', value: '0.10', validFrom: '2026-01-01', validTo: '2026-06-30', status: 'verified', source: 'fixture', verifiedBy: 'tests', verifiedOn: '2026-01-01' },
        { key: 'RATE', type: 'decimal', value: '0.12', validFrom: '2026-07-01', status: 'unverified', source: 'fixture, second half' },
        { key: 'TAX', type: 'brackets', validFrom: '2026-01-01', status: 'verified', source: 'fixture', verifiedBy: 'tests', verifiedOn: '2026-01-01',
          rows: [{ upTo: '500', rate: '0', deduct: '0' }, { rate: '0.2', deduct: '100' }] },
        { key: 'MEAL_CAP', type: 'decimal', value: '50', validFrom: '2026-01-01', status: 'verified', source: 'fixture', verifiedBy: 'tests', verifiedOn: '2026-01-01' },
      ],
      wageTypes: [
        { code: 'BASE', label: { en: 'Base', fr: 'Base' }, class: 'earning', bases: { GROSS: 1, SOCIAL: 1, TAXABLE: 1 } },
        { code: 'SOC', label: { en: 'Social', fr: 'Social' }, class: 'deduction', bases: { DEDUCTIONS: 1, TAXABLE: -1 } },
        { code: 'TAX', label: { en: 'Tax', fr: 'Impôt' }, class: 'deduction', bases: { DEDUCTIONS: 1 } },
        { code: 'NET', label: { en: 'Net', fr: 'Net' }, class: 'net' },
      ],
      treatmentClasses: [
        { code: 'TAXABLE', label: { en: 'Taxable', fr: 'Imposable' }, class: 'earning', bases: { GROSS: 1, SOCIAL: 1, TAXABLE: 1 } },
        { code: 'EXEMPT_MEAL', label: { en: 'Meal', fr: 'Repas' }, class: 'earning', bases: { GROSS: 1 },
          exemption: { ceilingParam: 'MEAL_CAP', exemptBases: { GROSS: 1 }, excessBases: { GROSS: 1, SOCIAL: 1, TAXABLE: 1 } } },
      ],
      schema: [
        { id: 'base', kind: 'line', wageType: 'BASE', amount: "input('SALARY') * input('DAYS') / param('DIVISOR')" },
        { id: 'variables', kind: 'variables', treatmentClasses: ['TAXABLE', 'EXEMPT_MEAL'] },
        { id: 'social', kind: 'line', wageType: 'SOC', amount: "min(base('SOCIAL'), param('CEILING')) * param('RATE')", rate: "param('RATE')" },
        { id: 'tax', kind: 'line', wageType: 'TAX', amount: "bracket('TAX', base('TAXABLE'))" },
        { id: 'net', kind: 'line', wageType: 'NET', amount: "base('GROSS') - base('DEDUCTIONS')", keepZero: true },
      ],
      checks: [
        { id: 'NO_SALARY', level: 'block', when: "input('SALARY') <= 0", message: { en: 'No salary', fr: 'Pas de salaire' } },
        { id: 'SHORT', level: 'warn', when: "input('DAYS') < param('DIVISOR')", message: { en: 'Short month', fr: 'Mois incomplet' } },
      ],
    },
  };
}
