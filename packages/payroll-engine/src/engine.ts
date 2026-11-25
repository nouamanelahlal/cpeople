import { createHash } from 'node:crypto';

import { evaluate, parseExpression, type Environment } from './expression.js';
import type { CountryPack, Localised, PayrollSection, WageType, WageTypeClass } from './pack.js';
import { ParameterSet, type ParameterUse } from './parameters.js';
import { Rational } from './rational.js';

/**
 * The payroll calculator (M12, M13; spec §11).
 *
 * It knows how to run a pack's schema over one employee's inputs, exactly and
 * explainably. It knows no country: every rate, base and formula comes from the
 * pack. Pure: the same pack, period and inputs always give the same result to
 * the cent, and the result carries a hash of what went in (CP-PAY-005).
 */

/** A company element for this run: a commission, a transport allowance, an advance. */
export interface VariableLine {
  readonly code: string;
  readonly label: Localised;
  /** One of the pack's treatment classes. */
  readonly treatmentClass: string;
  /** A decimal string in the pack's currency. */
  readonly amount: string;
  readonly glKey?: string;
}

export interface EmployeeInput {
  readonly employeeId: string;
  /** Values for the pack's declared inputs, as decimal strings. */
  readonly inputs: Readonly<Record<string, string>>;
  readonly variables?: readonly VariableLine[];
}

export interface CalculationRequest {
  readonly pack: CountryPack;
  /** The date parameters are read at: the last day of the period. */
  readonly asOf: string;
  readonly periodId: string;
  readonly employee: EmployeeInput;
  /**
   * In production an unverified parameter blocks the result (CP-PCK-004). In
   * simulation it is reported and the calculation goes on.
   */
  readonly mode: 'production' | 'simulation';
}

export interface ResultLine {
  readonly step: string;
  readonly code: string;
  readonly label: Localised;
  readonly class: WageTypeClass;
  /** Rounded to the currency's minor units, as a decimal string. */
  readonly amount: string;
  /** The same amount in minor units, as an integer string (JSON-safe). */
  readonly minor: string;
  readonly base?: string;
  readonly rate?: string;
  readonly quantity?: string;
  readonly payslip?: WageType['payslip'];
  readonly glKey?: string;
  /** How the line was made: the formula and every value it read. */
  readonly trace: {
    readonly formula: string;
    readonly parameters: readonly ParameterUse[];
    readonly inputs: readonly string[];
  };
}

export interface CheckResult {
  readonly id: string;
  readonly level: 'block' | 'warn' | 'info';
  readonly message: Localised;
}

export interface CalculationResult {
  readonly status: 'calculated' | 'blocked';
  readonly employeeId: string;
  readonly periodId: string;
  readonly pack: { readonly country: string; readonly version: string; readonly status: string };
  readonly currency: string;
  readonly lines: readonly ResultLine[];
  /** Final value of every cumulation, as decimal strings. */
  readonly bases: Readonly<Record<string, string>>;
  readonly totals: {
    readonly earnings: string;
    readonly deductions: string;
    readonly employer: string;
    readonly net: string;
    readonly employerCost: string;
  };
  readonly checks: readonly CheckResult[];
  /** Every parameter row read, once each. */
  readonly parameters: readonly ParameterUse[];
  readonly unverifiedParameters: readonly string[];
  readonly inputHash: string;
}

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}

export function calculate(request: CalculationRequest): CalculationResult {
  const { pack, asOf, employee } = request;
  const payroll: PayrollSection | undefined = pack.payroll;
  if (!payroll) throw new CalculationError(`Pack ${pack.manifest.country} has no payroll section.`);

  const scale = pack.manifest.minorUnits;
  const params = new ParameterSet(payroll.parameters);
  const wageTypes = new Map(payroll.wageTypes.map((w) => [w.code, w]));
  const treatments = new Map(payroll.treatmentClasses.map((t) => [t.code, t]));

  const inputs = resolveInputs(payroll, employee.inputs);
  const bases = new Map<string, Rational>();
  const amounts = new Map<string, Rational>();
  const lines: ResultLine[] = [];
  const allUses = new Map<string, ParameterUse>();

  // One environment per formula, so each line knows exactly what it read.
  const environment = (uses: ParameterUse[], read: Set<string>): Environment => {
    const note = (use: ParameterUse): void => {
      uses.push(use);
      allUses.set(`${use.key}@${use.validFrom}`, use);
    };
    return {
      input: (key) => {
        const value = inputs.get(key);
        if (value === undefined) throw new CalculationError(`Input "${key}" is not declared by the pack.`);
        read.add(key);
        return value;
      },
      param: (key) => {
        const { value, use } = params.decimal(key, asOf);
        note(use);
        return value;
      },
      base: (name) => bases.get(name) ?? Rational.ZERO,
      wt: (code) => amounts.get(code) ?? Rational.ZERO,
      band: (key, x) => {
        const { value, use } = params.band(key, asOf, x);
        note(use);
        return value;
      },
      bracket: (key, x) => {
        const { value, use } = params.bracket(key, asOf, x);
        note(use);
        return value;
      },
    };
  };

  const run = (formula: string, uses: ParameterUse[], read: Set<string>): Rational =>
    evaluate(parseExpression(formula), environment(uses, read));

  // 1. Checks before anything is calculated.
  const checks: CheckResult[] = [];
  for (const check of payroll.checks) {
    if (!run(check.when, [], new Set()).isZero()) {
      checks.push({ id: check.id, level: check.level, message: check.message });
    }
  }

  const addLine = (
    step: string,
    wageType: Pick<WageType, 'code' | 'label' | 'class' | 'payslip' | 'glKey'>,
    lineBases: Readonly<Record<string, 1 | -1>> | undefined,
    exact: Rational,
    extras: { base?: Rational; rate?: Rational; quantity?: Rational; formula: string; uses: ParameterUse[]; read: Set<string> },
    keepZero = false,
  ): void => {
    const minor = exact.toScaled(scale);
    const rounded = Rational.fromMinor(minor, scale);
    amounts.set(wageType.code, (amounts.get(wageType.code) ?? Rational.ZERO).add(rounded));
    for (const [name, sign] of Object.entries(lineBases ?? {})) {
      const signed = sign === 1 ? rounded : rounded.neg();
      bases.set(name, (bases.get(name) ?? Rational.ZERO).add(signed));
    }
    if (minor === 0n && !keepZero) return;
    lines.push({
      step,
      code: wageType.code,
      label: wageType.label,
      class: wageType.class,
      amount: rounded.toFixed(scale),
      minor: minor.toString(),
      ...(extras.base ? { base: extras.base.toFixed(scale) } : {}),
      ...(extras.rate ? { rate: extras.rate.toFixed(6) } : {}),
      ...(extras.quantity ? { quantity: extras.quantity.toFixed(4) } : {}),
      ...(wageType.payslip ? { payslip: wageType.payslip } : {}),
      ...(wageType.glKey ? { glKey: wageType.glKey } : {}),
      trace: { formula: extras.formula, parameters: dedupe(extras.uses), inputs: [...extras.read].sort() },
    });
  };

  const blockedByChecks = checks.some((c) => c.level === 'block');

  // 2. The schema, in order.
  if (!blockedByChecks) {
    for (const step of payroll.schema) {
      if (step.kind === 'line') {
        const uses: ParameterUse[] = [];
        const read = new Set<string>();
        if (step.when && run(step.when, uses, read).isZero()) continue;
        const wageType = wageTypes.get(step.wageType);
        if (!wageType) throw new CalculationError(`Step "${step.id}" uses unknown wage type "${step.wageType}".`);
        const amount = run(step.amount, uses, read);
        addLine(step.id, wageType, wageType.bases, amount, {
          ...(step.base ? { base: run(step.base, uses, read) } : {}),
          ...(step.rate ? { rate: run(step.rate, uses, read) } : {}),
          ...(step.quantity ? { quantity: run(step.quantity, uses, read) } : {}),
          formula: step.amount,
          uses,
          read,
        }, step.keepZero);
        continue;
      }

      for (const variable of employee.variables ?? []) {
        if (!step.treatmentClasses.includes(variable.treatmentClass)) continue;
        const treatment = treatments.get(variable.treatmentClass);
        if (!treatment) throw new CalculationError(`Unknown treatment class "${variable.treatmentClass}".`);
        const amount = Rational.parse(variable.amount);
        const shape = { code: variable.code, label: variable.label, class: treatment.class, ...(variable.glKey ? { glKey: variable.glKey } : {}) };

        if (!treatment.exemption) {
          addLine(step.id, shape, treatment.bases, amount, { formula: `variable ${variable.code}`, uses: [], read: new Set() });
          continue;
        }

        // Exempt up to the ceiling, taxable above it (spec §12 step 5).
        const uses: ParameterUse[] = [];
        const ceiling = run(`param('${treatment.exemption.ceilingParam}')`, uses, new Set());
        const exempt = Rational.min(amount, ceiling);
        const excess = amount.sub(exempt);
        addLine(step.id, shape, treatment.exemption.exemptBases, exempt, {
          formula: `min(variable ${variable.code}, param('${treatment.exemption.ceilingParam}'))`,
          uses,
          read: new Set(),
        });
        if (!excess.isZero()) {
          addLine(
            step.id,
            { ...shape, code: `${variable.code}.TAXABLE`, label: taxablePart(variable.label) },
            treatment.exemption.excessBases,
            excess,
            { formula: `variable ${variable.code} above the ceiling`, uses, read: new Set() },
          );
        }
      }
    }
  }

  const parameters = [...allUses.values()].sort((a, b) => a.key.localeCompare(b.key));
  const unverifiedParameters = parameters.filter((p) => p.status !== 'verified').map((p) => p.key);
  if (request.mode === 'production' && unverifiedParameters.length > 0) {
    checks.push({
      id: 'UNVERIFIED_PARAMETERS',
      level: 'block',
      message: {
        en: `Unverified legal values cannot be used in production: ${unverifiedParameters.join(', ')}.`,
        fr: `Des valeurs légales non vérifiées ne peuvent pas servir en production : ${unverifiedParameters.join(', ')}.`,
      },
    });
  }

  const blocked = checks.some((c) => c.level === 'block');
  const finalLines = blocked ? [] : lines;

  // 3. Totals, by class. A blocked result has no lines and so no totals.
  const sum = (cls: WageTypeClass): Rational =>
    finalLines.filter((l) => l.class === cls).reduce((acc, l) => acc.add(Rational.parse(l.amount)), Rational.ZERO);
  const earnings = sum('earning');
  const deductions = sum('deduction');
  const employer = sum('employer');
  const netLine = finalLines.find((l) => l.class === 'net');
  const net = netLine ? Rational.parse(netLine.amount) : earnings.sub(deductions);

  return {
    status: blocked ? 'blocked' : 'calculated',
    employeeId: employee.employeeId,
    periodId: request.periodId,
    pack: { country: pack.manifest.country, version: pack.manifest.version, status: pack.manifest.status },
    currency: pack.manifest.currency,
    lines: finalLines,
    bases: Object.fromEntries([...bases.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.toFixed(scale)])),
    totals: {
      earnings: earnings.toFixed(scale),
      deductions: deductions.toFixed(scale),
      employer: employer.toFixed(scale),
      net: net.toFixed(scale),
      employerCost: earnings.add(employer).toFixed(scale),
    },
    checks,
    parameters,
    unverifiedParameters,
    inputHash: inputHash(request),
  };
}

function resolveInputs(payroll: PayrollSection, given: Readonly<Record<string, string>>): Map<string, Rational> {
  const declared = new Set(payroll.inputs.map((i) => i.key));
  for (const key of Object.keys(given)) {
    if (!declared.has(key)) throw new CalculationError(`Input "${key}" is not declared by the pack.`);
  }
  const values = new Map<string, Rational>();
  for (const input of payroll.inputs) {
    const raw = given[input.key] ?? input.default;
    if (raw === undefined) throw new CalculationError(`Input "${input.key}" is required.`);
    values.set(input.key, Rational.parse(raw));
  }
  return values;
}

function dedupe(uses: readonly ParameterUse[]): ParameterUse[] {
  const seen = new Map<string, ParameterUse>();
  for (const use of uses) seen.set(`${use.key}@${use.validFrom}`, use);
  return [...seen.values()];
}

function taxablePart(label: Localised): Localised {
  return { en: `${label.en} (taxable part)`, fr: `${label.fr} (part imposable)` };
}

/** A stable fingerprint of what the calculation was given (Kawadir v0.5 inputHash). */
export function inputHash(request: CalculationRequest): string {
  const canonical = JSON.stringify({
    pack: `${request.pack.manifest.country}@${request.pack.manifest.version}`,
    asOf: request.asOf,
    period: request.periodId,
    employee: request.employee.employeeId,
    inputs: Object.entries(request.employee.inputs).sort(([a], [b]) => a.localeCompare(b)),
    variables: (request.employee.variables ?? []).map((v) => [v.code, v.treatmentClass, v.amount]),
    mode: request.mode,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
