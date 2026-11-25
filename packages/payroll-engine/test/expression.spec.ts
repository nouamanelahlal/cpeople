import { describe, expect, it } from 'vitest';

import { evaluate, parseExpression, referencesOf, type Environment } from '../src/expression.js';
import { Rational } from '../src/rational.js';

const env = (values: Record<string, string> = {}): Environment => {
  const get = (k: string): Rational => Rational.parse(values[k] ?? '0');
  return {
    input: get,
    param: get,
    base: get,
    wt: get,
    band: () => Rational.parse('0.05'),
    bracket: (_k, x) => x.mul(Rational.parse('0.1')),
  };
};
const run = (formula: string, values?: Record<string, string>): string => evaluate(parseExpression(formula), env(values)).toFixed(4);

describe('rules language (spec §11, CP-PAY-002)', () => {
  it('follows arithmetic precedence', () => {
    expect(run('2 + 3 * 4')).toBe('14.0000');
    expect(run('(2 + 3) * 4')).toBe('20.0000');
    expect(run('-2 * -3')).toBe('6.0000');
    expect(run('10 / 4')).toBe('2.5000');
  });

  it('compares and combines into 1 and 0', () => {
    expect(run('3 > 2 and 1 <= 1')).toBe('1.0000');
    expect(run('3 > 2 && 1 > 1')).toBe('0.0000');
    expect(run('not (1 == 2)')).toBe('1.0000');
  });

  it('evaluates only the branch taken', () => {
    expect(run("if(input('D') > 0, 10 / input('D'), 0)", { D: '0' })).toBe('0.0000');
    expect(run("if(input('D') > 0, 10 / input('D'), 0)", { D: '4' })).toBe('2.5000');
  });

  it('reads the world through named functions', () => {
    expect(run("min(base('SOCIAL'), param('CEIL')) * param('RATE')", { SOCIAL: '10000', CEIL: '6000', RATE: '0.0448' })).toBe('268.8000');
    expect(run("round(input('X') / 3, 2)", { X: '10' })).toBe('3.3300');
    expect(run("band('SEN', 3) * 100")).toBe('5.0000');
  });

  it('refuses what it does not know', () => {
    expect(() => parseExpression('eval(1)')).toThrow(/Unknown function/);
    expect(() => parseExpression('input(KEY)')).toThrow();
    expect(() => parseExpression("min('A', 2)")).toThrow(/must be a number/);
    expect(() => parseExpression("param('A'")).toThrow();
    expect(() => parseExpression('1 +')).toThrow();
    expect(() => parseExpression("input('a b')")).toThrow();
    expect(() => parseExpression('1; 2')).toThrow(/Unexpected character/);
  });

  it('lists what a formula reads', () => {
    const refs = referencesOf(parseExpression("bracket('IR', base('TAXABLE') - wt('X')) + param('P') * input('I')"));
    expect([...refs.tables]).toEqual(['IR']);
    expect([...refs.bases]).toEqual(['TAXABLE']);
    expect([...refs.wageTypes]).toEqual(['X']);
    expect([...refs.params]).toEqual(['P']);
    expect([...refs.inputs]).toEqual(['I']);
  });
});
