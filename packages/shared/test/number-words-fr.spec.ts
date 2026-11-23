import { describe, expect, it } from 'vitest';
import { frenchNumberWords } from '../src/number-words-fr.js';

// A contract says the salary in figures and in words (HR-01 spec 6.6), so the
// words have to be the ones a French contract is written with.

describe('numbers in French words', () => {
  it('counts to twenty', () => {
    expect(frenchNumberWords(0)).toBe('zéro');
    expect(frenchNumberWords(7)).toBe('sept');
    expect(frenchNumberWords(16)).toBe('seize');
    expect(frenchNumberWords(19)).toBe('dix-neuf');
  });

  it('writes the tens the way French counts them', () => {
    expect(frenchNumberWords(21)).toBe('vingt et un');
    expect(frenchNumberWords(32)).toBe('trente-deux');
    expect(frenchNumberWords(71)).toBe('soixante et onze');
    expect(frenchNumberWords(77)).toBe('soixante-dix-sept');
    expect(frenchNumberWords(80)).toBe('quatre-vingts');
    expect(frenchNumberWords(81)).toBe('quatre-vingt-un');
    expect(frenchNumberWords(99)).toBe('quatre-vingt-dix-neuf');
  });

  it('gives "cent" its s only when it is a round multiple', () => {
    expect(frenchNumberWords(100)).toBe('cent');
    expect(frenchNumberWords(101)).toBe('cent un');
    expect(frenchNumberWords(200)).toBe('deux cents');
    expect(frenchNumberWords(210)).toBe('deux cent dix');
  });

  it('never writes "un mille", and never an s on "mille"', () => {
    expect(frenchNumberWords(1000)).toBe('mille');
    expect(frenchNumberWords(2000)).toBe('deux mille');
    expect(frenchNumberWords(6500)).toBe('six mille cinq cents');
    expect(frenchNumberWords(15_000)).toBe('quinze mille');
  });

  it('handles the amounts a salary is actually written in', () => {
    expect(frenchNumberWords(6500)).toBe('six mille cinq cents');
    expect(frenchNumberWords(12_750)).toBe('douze mille sept cent cinquante');
    expect(frenchNumberWords(1_000_000)).toBe('un million');
    expect(frenchNumberWords(2_300_000)).toBe('deux millions trois cent mille');
  });

  it('ignores what it cannot say', () => {
    expect(frenchNumberWords(Number.NaN)).toBe('');
    expect(frenchNumberWords(-12)).toBe('moins douze');
    // Centimes are written in figures beside the words, not in them.
    expect(frenchNumberWords(6500.75)).toBe('six mille cinq cents');
  });
});

describe('French spelling before mille and millions', () => {
  it('drops the s from cent and vingt when a bigger word follows', () => {
    expect(frenchNumberWords(300_000)).toBe('trois cent mille');
    expect(frenchNumberWords(80_000)).toBe('quatre-vingt mille');
    // And keeps it when nothing does.
    expect(frenchNumberWords(300)).toBe('trois cents');
    expect(frenchNumberWords(80)).toBe('quatre-vingts');
  });
});
