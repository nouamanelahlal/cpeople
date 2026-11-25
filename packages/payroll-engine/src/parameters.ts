import type { Parameter } from './pack.js';
import { Rational } from './rational.js';

/** The row that was read, so every payslip line can say which value it used. */
export interface ParameterUse {
  readonly key: string;
  readonly validFrom: string;
  readonly status: Parameter['status'];
  readonly source: string;
}

export class ParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParameterError';
  }
}

/**
 * Effective-dated parameter rows (CLAUDE.md rule 3), read as of one date.
 *
 * A key may have many rows over time; exactly one may be in force on a date.
 * The validator refuses overlaps, so the lookup here can be simple.
 */
export class ParameterSet {
  readonly #byKey = new Map<string, Parameter[]>();

  constructor(rows: readonly Parameter[]) {
    for (const row of rows) {
      const list = this.#byKey.get(row.key) ?? [];
      list.push(row);
      this.#byKey.set(row.key, list);
    }
  }

  has(key: string): boolean {
    return this.#byKey.has(key);
  }

  keys(): string[] {
    return [...this.#byKey.keys()];
  }

  /** The row of `key` in force on `date` ("YYYY-MM-DD"). */
  row(key: string, date: string): Parameter {
    const rows = this.#byKey.get(key);
    if (!rows) throw new ParameterError(`No parameter "${key}" in the pack.`);
    const row = rows.find((r) => r.validFrom <= date && (r.validTo === undefined || date <= r.validTo));
    if (!row) throw new ParameterError(`Parameter "${key}" has no row in force on ${date}.`);
    return row;
  }

  decimal(key: string, date: string): { value: Rational; use: ParameterUse } {
    const row = this.row(key, date);
    if (row.type !== 'decimal') throw new ParameterError(`Parameter "${key}" is a ${row.type} table, not a value.`);
    return { value: Rational.parse(row.value), use: useOf(row) };
  }

  /** The rate of the band x falls in; zero below the first band. */
  band(key: string, date: string, x: Rational): { value: Rational; use: ParameterUse } {
    const row = this.row(key, date);
    if (row.type !== 'bands') throw new ParameterError(`Parameter "${key}" is not a band table.`);
    let rate = Rational.ZERO;
    let best: Rational | undefined;
    for (const band of row.rows) {
      const from = Rational.parse(band.from);
      if (from.cmp(x) <= 0 && (best === undefined || from.cmp(best) > 0)) {
        best = from;
        rate = Rational.parse(band.rate);
      }
    }
    return { value: rate, use: useOf(row) };
  }

  /** x × rate − deduct for the bracket x falls in, never below zero. */
  bracket(key: string, date: string, x: Rational): { value: Rational; use: ParameterUse } {
    const row = this.row(key, date);
    if (row.type !== 'brackets') throw new ParameterError(`Parameter "${key}" is not a bracket table.`);
    const hit =
      row.rows.find((b) => b.upTo !== undefined && x.cmp(Rational.parse(b.upTo)) <= 0) ??
      row.rows.find((b) => b.upTo === undefined);
    if (!hit) throw new ParameterError(`Parameter "${key}" has no bracket for ${x.toFixed(2)}.`);
    const tax = x.mul(Rational.parse(hit.rate)).sub(Rational.parse(hit.deduct));
    return { value: Rational.max(tax, Rational.ZERO), use: useOf(row) };
  }
}

function useOf(row: Parameter): ParameterUse {
  return { key: row.key, validFrom: row.validFrom, status: row.status, source: row.source };
}
