import { describe, expect, it } from 'vitest';

import { Rational } from '../src/rational.js';

describe('Rational (CLAUDE.md rule 4: no floats)', () => {
  it('parses decimals exactly and refuses anything else', () => {
    expect(Rational.parse('0.0448').toString()).toBe('28/625');
    expect(Rational.parse('-12.50').toFixed(2)).toBe('-12.50');
    expect(() => Rational.parse('1e3')).toThrow();
    expect(() => Rational.parse('12,5')).toThrow();
    expect(() => Rational.of(0.1)).toThrow();
  });

  it('keeps 0.1 + 0.2 exact', () => {
    expect(Rational.parse('0.1').add(Rational.parse('0.2')).cmp(Rational.parse('0.3'))).toBe(0);
  });

  it('carries thirds exactly and rounds only when asked', () => {
    const monthlyCap = Rational.parse('35000').div(Rational.of(12));
    expect(monthlyCap.toString()).toBe('8750/3');
    expect(monthlyCap.toFixed(2)).toBe('2916.67');
    expect(monthlyCap.mul(Rational.of(12)).toFixed(2)).toBe('35000.00');
  });

  it('rounds half away from zero', () => {
    expect(Rational.parse('2.345').toFixed(2)).toBe('2.35');
    expect(Rational.parse('-2.345').toFixed(2)).toBe('-2.35');
    expect(Rational.parse('2.344').toFixed(2)).toBe('2.34');
    expect(Rational.parse('0.005').toScaled(2)).toBe(1n);
  });

  it('floors and compares', () => {
    expect(Rational.parse('7.9').floor().toString()).toBe('7');
    expect(Rational.parse('-7.1').floor().toString()).toBe('-8');
    expect(Rational.min(Rational.of(3), Rational.of(5)).toString()).toBe('3');
  });

  it('refuses division by zero', () => {
    expect(() => Rational.of(1).div(Rational.ZERO)).toThrow(RangeError);
  });
});
