import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { importCountryPack, importCountryPackText } from '../src/validate.js';
import { fictionalPack } from './fixture.js';

const template = readFileSync(fileURLToPath(new URL('../templates/country-pack.template.json', import.meta.url)), 'utf8');
const messages = (json: unknown): string[] => {
  const r = importCountryPack(json);
  return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`);
};

describe('country-pack import (M27; spec §7)', () => {
  it('accepts the blank template, with HR only and no payroll', () => {
    const r = importCountryPackText(template);
    expect(r.ok).toBe(true);
  });

  it('accepts a well-formed pack with payroll', () => {
    expect(messages(fictionalPack())).toEqual([]);
  });

  it('refuses text that is not JSON, or not a pack', () => {
    expect(importCountryPackText('{').ok).toBe(false);
    expect(messages([])).toEqual([': A pack is a JSON object.']);
  });

  it('refuses overlapping rows of the same parameter', () => {
    const pack = fictionalPack();
    const rows = pack.payroll!.parameters.map((p) => (p.key === 'RATE' && p.validTo ? { ...p, validTo: '2026-07-15' } : p));
    expect(messages({ ...pack, payroll: { ...pack.payroll!, parameters: rows } }).join()).toMatch(/overlap/);
  });

  it('refuses a float where a decimal string belongs', () => {
    const pack = fictionalPack();
    const rows = pack.payroll!.parameters.map((p) => (p.key === 'CEILING' ? { ...p, value: 1000 } : p));
    expect(messages({ ...pack, payroll: { ...pack.payroll!, parameters: rows } }).join()).toMatch(/Never a float/);
  });

  it('refuses a formula that reads something undefined, or a line before it exists', () => {
    const pack = fictionalPack();
    const schema = [
      { id: 'early', kind: 'line', wageType: 'NET', amount: "wt('TAX') + param('NOPE') + input('GHOST')" },
      ...pack.payroll!.schema,
    ];
    const found = messages({ ...pack, payroll: { ...pack.payroll!, schema } }).join('\n');
    expect(found).toMatch(/wt\('TAX'\) before any step/);
    expect(found).toMatch(/parameter "NOPE"/);
    expect(found).toMatch(/input "GHOST"/);
  });

  it('refuses a validated pack that still holds unverified values', () => {
    const pack = fictionalPack();
    const validated = { ...pack, manifest: { ...pack.manifest, status: 'validated', validator: 'Expert', validatedOn: '2026-12-01' } };
    expect(messages(validated).join()).toMatch(/verified values only/);
  });

  it('refuses a verified row without who and when', () => {
    const pack = fictionalPack();
    const rows = pack.payroll!.parameters.map((p) => (p.key === 'DIVISOR' ? { ...p, verifiedBy: undefined } : p));
    expect(messages({ ...pack, payroll: { ...pack.payroll!, parameters: rows } }).join()).toMatch(/verifiedBy/);
  });

  it('refuses a manifest without the basics', () => {
    const found = messages({ format: 'cpeople-country-pack/1', manifest: { country: 'ma', status: 'live' } }).join('\n');
    expect(found).toMatch(/manifest.country/);
    expect(found).toMatch(/manifest.status/);
    expect(found).toMatch(/manifest.currency/);
  });
});
