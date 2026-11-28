import { ExpressionError, parseExpression, referencesOf } from './expression.js';
import {
  PACK_STATUSES,
  WAGE_TYPE_CLASSES,
  type CountryPack,
  type Parameter,
  type PayrollSection,
} from './pack.js';
import { Rational } from './rational.js';

/**
 * Validating and importing a country pack (M27; spec §7, CP-PCK-003).
 *
 * A pack arrives as JSON: written by ConSAP, copied from the template, or
 * handed over by a local partner. Nothing in it is trusted until it passes
 * here: the manifest, every parameter row and its dates, every formula and
 * every name a formula reads. A pack that fails is refused whole, with the
 * list of what to fix, so a half-valid country can never reach a payroll run.
 */

export interface PackIssue {
  /** Where, as a JSON path: "payroll.parameters[3].validTo". */
  readonly path: string;
  readonly message: string;
}

export type ImportResult =
  | { readonly ok: true; readonly pack: CountryPack; readonly warnings: readonly PackIssue[] }
  | { readonly ok: false; readonly errors: readonly PackIssue[]; readonly warnings: readonly PackIssue[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[A-Z][A-Z0-9_]*$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/** Parses JSON text and validates it. */
export function importCountryPackText(text: string): ImportResult {
  if (text.length > 2_000_000) {
    return { ok: false, errors: [{ path: '', message: 'The file is larger than 2 MB.' }], warnings: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [{ path: '', message: `Not valid JSON: ${(error as Error).message}` }], warnings: [] };
  }
  return importCountryPack(json);
}

export function importCountryPack(json: unknown): ImportResult {
  const errors: PackIssue[] = [];
  const warnings: PackIssue[] = [];
  const err = (path: string, message: string): void => void errors.push({ path, message });
  const warn = (path: string, message: string): void => void warnings.push({ path, message });

  if (!isObject(json)) return { ok: false, errors: [{ path: '', message: 'A pack is a JSON object.' }], warnings };
  if (json.format !== 'cpeople-country-pack/1') err('format', 'Expected "cpeople-country-pack/1".');

  const manifest = json.manifest;
  if (!isObject(manifest)) {
    err('manifest', 'Missing.');
    return { ok: false, errors, warnings };
  }
  const m = (key: string): unknown => manifest[key];
  if (!(typeof m('country') === 'string' && /^[A-Z]{2}$/.test(m('country') as string))) err('manifest.country', 'Two upper-case letters (ISO 3166-1).');
  checkLocalised(m('name'), 'manifest.name', err);
  if (!(typeof m('version') === 'string' && /^\d{4}\.\d+\.\d+$/.test(m('version') as string))) err('manifest.version', 'Expected "YYYY.release.fix", e.g. "2026.1.0".');
  if (!PACK_STATUSES.includes(m('status') as never)) err('manifest.status', `One of: ${PACK_STATUSES.join(', ')}.`);
  if (!(typeof m('currency') === 'string' && /^[A-Z]{3}$/.test(m('currency') as string))) err('manifest.currency', 'Three upper-case letters (ISO 4217).');
  if (!(Number.isInteger(m('minorUnits')) && (m('minorUnits') as number) >= 0 && (m('minorUnits') as number) <= 4)) err('manifest.minorUnits', 'An integer from 0 to 4.');
  if (!['en', 'fr', 'ar'].includes(m('defaultLanguage') as string)) err('manifest.defaultLanguage', 'en, fr or ar.');
  if (!isStringArray(m('modules'))) err('manifest.modules', 'A list of module names.');
  if (!isStringArray(m('lawBasis'))) err('manifest.lawBasis', 'A list of the texts the pack follows (may be empty for a placeholder).');
  if (!nonEmpty(m('owner'))) err('manifest.owner', 'Who maintains the pack.');

  const status = m('status') as string;
  const signedOff = status === 'validated' || status === 'released';
  if (signedOff) {
    if (!nonEmpty(m('validator'))) err('manifest.validator', `A ${status} pack names who validated it.`);
    if (!isDate(m('validatedOn'))) err('manifest.validatedOn', `A ${status} pack carries the validation date.`);
  }

  // HR sections: fields, holidays, leave.
  arrayOf(json.fields, 'fields', (field, path) => {
    if (!nonEmpty(field.key)) err(`${path}.key`, 'Required.');
    checkLocalised(field.label, `${path}.label`, err);
    if (!['employee', 'employer'].includes(field.appliesTo as string)) err(`${path}.appliesTo`, 'employee or employer.');
    if (field.pattern !== undefined) {
      try {
        new RegExp(String(field.pattern));
      } catch {
        err(`${path}.pattern`, 'Not a valid regular expression.');
      }
    }
    checkStatus(field.status, `${path}.status`, err, signedOff);
  }, err);

  arrayOf(json.holidays, 'holidays', (holiday, path) => {
    const date = String(holiday.date ?? '');
    if (!/^\d{2}-\d{2}$/.test(date) && !ISO_DATE.test(date)) err(`${path}.date`, '"MM-DD" for a fixed holiday or "YYYY-MM-DD" for one year.');
    checkLocalised(holiday.label, `${path}.label`, err);
  }, err);

  const leaveCodes = new Set<string>();
  arrayOf(json.leaveTypes, 'leaveTypes', (leave, path) => {
    const code = String(leave.code ?? '');
    if (!CODE.test(code)) err(`${path}.code`, 'Letters, digits, "_", "." or "-".');
    if (leaveCodes.has(code)) err(`${path}.code`, `Duplicate code "${code}".`);
    leaveCodes.add(code);
    checkLocalised(leave.label, `${path}.label`, err);
    if (typeof leave.paid !== 'boolean') err(`${path}.paid`, 'true or false.');
    if (leave.days !== undefined && !isDecimal(leave.days)) err(`${path}.days`, 'A decimal string.');
    if (!['days', 'weeks', 'hours'].includes(leave.unit as string)) err(`${path}.unit`, 'days, weeks or hours.');
    checkStatus(leave.status, `${path}.status`, err, signedOff);
  }, err);

  if (json.payroll === undefined) {
    if (status !== 'placeholder' && status !== 'retired') {
      warn('payroll', `A "${status}" pack without a payroll section: payroll stays disabled for this country.`);
    }
  } else if (!isObject(json.payroll)) {
    err('payroll', 'An object.');
  } else {
    validatePayroll(json.payroll, signedOff, err, warn);
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  return { ok: true, pack: json as unknown as CountryPack, warnings };
}

function validatePayroll(
  payroll: Record<string, unknown>,
  signedOff: boolean,
  err: (path: string, message: string) => void,
  warn: (path: string, message: string) => void,
): void {
  for (const key of ['inputs', 'parameters', 'wageTypes', 'treatmentClasses', 'schema', 'checks']) {
    if (!Array.isArray(payroll[key])) err(`payroll.${key}`, 'A list (may be empty).');
  }
  const p = payroll as unknown as PayrollSection;
  if (errors(p)) return;

  // Inputs.
  const inputs = new Set<string>();
  p.inputs.forEach((input, i) => {
    const path = `payroll.inputs[${i}]`;
    if (!KEY.test(String(input.key))) err(`${path}.key`, 'UPPER_SNAKE_CASE.');
    if (inputs.has(input.key)) err(`${path}.key`, `Duplicate input "${input.key}".`);
    inputs.add(input.key);
    checkLocalised(input.label, `${path}.label`, err);
    if (input.default !== undefined && !isDecimal(input.default)) err(`${path}.default`, 'A decimal string.');
  });

  // Parameters: shape, dates, no overlap, and the verification rule.
  const params = new Map<string, Parameter[]>();
  p.parameters.forEach((row, i) => {
    const path = `payroll.parameters[${i}]`;
    if (!KEY.test(String(row.key))) err(`${path}.key`, 'UPPER_SNAKE_CASE.');
    if (!isDate(row.validFrom)) err(`${path}.validFrom`, 'A date, "YYYY-MM-DD".');
    if (row.validTo !== undefined && (!isDate(row.validTo) || row.validTo < row.validFrom)) err(`${path}.validTo`, 'A date on or after validFrom.');
    checkStatus(row.status, `${path}.status`, err, signedOff);
    if (!nonEmpty(row.source)) err(`${path}.source`, 'Say where the value comes from (CLAUDE.md rule 3).');
    if (row.status === 'verified' && (!nonEmpty(row.verifiedBy) || !isDate(row.verifiedOn))) {
      err(`${path}`, 'A verified row names who verified it (verifiedBy) and when (verifiedOn).');
    }
    switch (row.type) {
      case 'decimal':
        if (!isDecimal(row.value)) err(`${path}.value`, 'A decimal string, e.g. "0.0448". Never a float.');
        break;
      case 'bands':
        if (!Array.isArray(row.rows) || row.rows.length === 0) err(`${path}.rows`, 'At least one band.');
        else row.rows.forEach((band, j) => {
          if (!isDecimal(band.from)) err(`${path}.rows[${j}].from`, 'A decimal string.');
          if (!isDecimal(band.rate)) err(`${path}.rows[${j}].rate`, 'A decimal string.');
        });
        break;
      case 'brackets':
        if (!Array.isArray(row.rows) || row.rows.length === 0) err(`${path}.rows`, 'At least one bracket.');
        else {
          let previous: Rational | undefined;
          row.rows.forEach((bracket, j) => {
            const last = j === row.rows.length - 1;
            if (!isDecimal(bracket.rate)) err(`${path}.rows[${j}].rate`, 'A decimal string.');
            if (!isDecimal(bracket.deduct)) err(`${path}.rows[${j}].deduct`, 'A decimal string.');
            if (last && bracket.upTo !== undefined) err(`${path}.rows[${j}].upTo`, 'The last bracket has no upper limit.');
            if (!last) {
              if (!isDecimal(bracket.upTo)) err(`${path}.rows[${j}].upTo`, 'A decimal string.');
              else {
                const upTo = Rational.parse(bracket.upTo as string);
                if (previous && upTo.cmp(previous) <= 0) err(`${path}.rows[${j}].upTo`, 'Brackets must go up.');
                previous = upTo;
              }
            }
          });
        }
        break;
      default:
        err(`${path}.type`, 'decimal, bands or brackets.');
    }
    const list = params.get(row.key) ?? [];
    list.push(row);
    params.set(row.key, list);
  });
  for (const [key, rows] of params) {
    const sorted = [...rows].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    for (let i = 1; i < sorted.length; i++) {
      const before = sorted[i - 1]!;
      if (before.validTo === undefined || before.validTo >= sorted[i]!.validFrom) {
        err('payroll.parameters', `"${key}": rows from ${before.validFrom} and ${sorted[i]!.validFrom} overlap. Close the older one with validTo.`);
      }
      if (before.type !== sorted[i]!.type) err('payroll.parameters', `"${key}": every row must have the same type.`);
    }
  }

  // Wage types and treatment classes.
  const wageTypes = new Set<string>();
  const fedBases = new Set<string>();
  p.wageTypes.forEach((wt, i) => {
    const path = `payroll.wageTypes[${i}]`;
    if (!CODE.test(String(wt.code))) err(`${path}.code`, 'Letters, digits, "_", "." or "-".');
    if (wageTypes.has(wt.code)) err(`${path}.code`, `Duplicate wage type "${wt.code}".`);
    wageTypes.add(wt.code);
    checkLocalised(wt.label, `${path}.label`, err);
    if (!WAGE_TYPE_CLASSES.includes(wt.class)) err(`${path}.class`, `One of: ${WAGE_TYPE_CLASSES.join(', ')}.`);
    checkBases(wt.bases, `${path}.bases`, err, fedBases);
  });
  const treatments = new Set<string>();
  p.treatmentClasses.forEach((t, i) => {
    const path = `payroll.treatmentClasses[${i}]`;
    if (!CODE.test(String(t.code))) err(`${path}.code`, 'Letters, digits, "_", "." or "-".');
    if (treatments.has(t.code)) err(`${path}.code`, `Duplicate treatment class "${t.code}".`);
    treatments.add(t.code);
    checkLocalised(t.label, `${path}.label`, err);
    if (!['earning', 'deduction'].includes(t.class)) err(`${path}.class`, 'earning or deduction.');
    checkBases(t.bases, `${path}.bases`, err, fedBases);
    if (t.exemption) {
      if (!params.has(t.exemption.ceilingParam)) err(`${path}.exemption.ceilingParam`, `No parameter "${t.exemption.ceilingParam}".`);
      checkBases(t.exemption.exemptBases, `${path}.exemption.exemptBases`, err, fedBases);
      checkBases(t.exemption.excessBases, `${path}.exemption.excessBases`, err, fedBases);
    }
  });

  // Formulas: they parse, and everything they read exists — and a wage type is
  // read only after the step that makes it.
  const produced = new Set<string>();
  const checkFormula = (formula: unknown, path: string, readable: Set<string>): void => {
    if (typeof formula !== 'string') {
      err(path, 'A formula (text).');
      return;
    }
    try {
      const refs = referencesOf(parseExpression(formula));
      refs.inputs.forEach((k) => inputs.has(k) || err(path, `Reads input "${k}", which is not declared in payroll.inputs.`));
      refs.params.forEach((k) => {
        const rows = params.get(k);
        if (!rows) err(path, `Reads parameter "${k}", which the pack does not define.`);
        else if (rows[0]!.type !== 'decimal') err(path, `param('${k}') needs a decimal; "${k}" is a ${rows[0]!.type} table.`);
      });
      refs.tables.forEach((k) => {
        const rows = params.get(k);
        if (!rows) err(path, `Reads table "${k}", which the pack does not define.`);
        else if (rows[0]!.type === 'decimal') err(path, `"${k}" is a single value, not a band or bracket table.`);
      });
      refs.wageTypes.forEach((k) => readable.has(k) || err(path, `Reads wt('${k}') before any step calculates it.`));
      refs.bases.forEach((k) => fedBases.has(k) || warn(path, `Reads base('${k}'), which no wage type feeds: it will always be zero.`));
    } catch (error) {
      err(path, error instanceof ExpressionError ? error.message : String(error));
    }
  };

  const stepIds = new Set<string>();
  p.schema.forEach((step, i) => {
    const path = `payroll.schema[${i}]`;
    if (!nonEmpty(step.id)) err(`${path}.id`, 'Required.');
    if (stepIds.has(step.id)) err(`${path}.id`, `Duplicate step "${step.id}".`);
    stepIds.add(step.id);
    if (step.kind === 'line') {
      if (!wageTypes.has(step.wageType)) err(`${path}.wageType`, `Unknown wage type "${step.wageType}".`);
      for (const field of ['amount', 'base', 'rate', 'quantity', 'when'] as const) {
        if (field === 'amount' || step[field] !== undefined) checkFormula(step[field], `${path}.${field}`, produced);
      }
      produced.add(step.wageType);
    } else if (step.kind === 'variables') {
      if (!Array.isArray(step.treatmentClasses)) err(`${path}.treatmentClasses`, 'A list.');
      else step.treatmentClasses.forEach((c) => treatments.has(c) || err(`${path}.treatmentClasses`, `Unknown treatment class "${c}".`));
    } else {
      err(`${path}.kind`, 'line or variables.');
    }
  });

  p.checks.forEach((check, i) => {
    const path = `payroll.checks[${i}]`;
    if (!nonEmpty(check.id)) err(`${path}.id`, 'Required.');
    if (!['block', 'warn', 'info'].includes(check.level)) err(`${path}.level`, 'block, warn or info.');
    checkLocalised(check.message, `${path}.message`, err);
    // Checks run before the schema: they may read inputs and parameters only.
    checkFormula(check.when, `${path}.when`, new Set());
  });

  if (p.schema.length === 0) warn('payroll.schema', 'No calculation steps: payroll will produce nothing.');
}

// --- small helpers -----------------------------------------------------------

function errors(p: PayrollSection): boolean {
  return !Array.isArray(p.inputs) || !Array.isArray(p.parameters) || !Array.isArray(p.wageTypes) ||
    !Array.isArray(p.treatmentClasses) || !Array.isArray(p.schema) || !Array.isArray(p.checks);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}
function isDate(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isDecimal(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    Rational.parse(value);
    return true;
  } catch {
    return false;
  }
}
function checkLocalised(value: unknown, path: string, err: (path: string, message: string) => void): void {
  if (!isObject(value) || !nonEmpty(value.en) || !nonEmpty(value.fr)) err(path, 'Needs an English ("en") and a French ("fr") text.');
}
function checkStatus(value: unknown, path: string, err: (path: string, message: string) => void, signedOff: boolean): void {
  if (value !== 'unverified' && value !== 'verified') err(path, 'unverified or verified.');
  else if (signedOff && value !== 'verified') err(path, 'A validated or released pack holds verified values only.');
}
function checkBases(
  bases: unknown,
  path: string,
  err: (path: string, message: string) => void,
  fed: Set<string>,
): void {
  if (bases === undefined) return;
  if (!isObject(bases)) {
    err(path, 'An object of base names to 1 or -1.');
    return;
  }
  for (const [name, sign] of Object.entries(bases)) {
    if (!KEY.test(name)) err(path, `Base "${name}" must be UPPER_SNAKE_CASE.`);
    if (sign !== 1 && sign !== -1) err(path, `Base "${name}" takes 1 or -1.`);
    fed.add(name);
  }
}
function arrayOf(
  value: unknown,
  path: string,
  each: (item: Record<string, unknown>, path: string) => void,
  err: (path: string, message: string) => void,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    err(path, 'A list.');
    return;
  }
  value.forEach((item, i) => (isObject(item) ? each(item, `${path}[${i}]`) : err(`${path}[${i}]`, 'An object.')));
}
