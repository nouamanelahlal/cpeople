/**
 * The country-pack format (M24, M27; spec §7).
 *
 * A country is data, not code: one JSON document that ConSAP writes, validates
 * and imports. Morocco is the first pack written in this format
 * (`packages/country-packs/ma/pack.json`); `templates/country-pack.template.json`
 * is the blank one a new country starts from.
 *
 * Nothing here names a country, a contribution or a tax. Those are the pack's
 * own codes and words.
 */

/** Where a pack may run (spec §7, status rules). */
export const PACK_STATUSES = ['placeholder', 'template', 'prototype', 'validated', 'released', 'retired'] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

export type Localised = { readonly en: string; readonly fr: string; readonly ar?: string };

export interface PackManifest {
  /** ISO 3166-1 alpha-2, upper case: "MA". */
  readonly country: string;
  readonly name: Localised;
  /** "2026.1.0": year of the law it follows, release, fix. */
  readonly version: string;
  readonly status: PackStatus;
  /** ISO 4217: "MAD". */
  readonly currency: string;
  /** Decimals of the currency: 2 for MAD and EUR, 0 for JPY. */
  readonly minorUnits: number;
  readonly defaultLanguage: 'en' | 'fr' | 'ar';
  readonly modules: readonly string[];
  /** The texts the pack follows, in plain words. */
  readonly lawBasis: readonly string[];
  readonly owner: string;
  /** Who signed the values off. Empty until someone has. */
  readonly validator?: string;
  readonly validatedOn?: string;
  /** When the pack must be looked at again (the next finance law). */
  readonly nextReview?: string;
  readonly notes?: string;
}

/** Whether a value has been checked against the official text (CLAUDE.md rule 3). */
export type ParameterStatus = 'unverified' | 'verified';

interface ParameterBase {
  readonly key: string;
  readonly label?: Localised;
  /** First day the row applies, "YYYY-MM-DD". */
  readonly validFrom: string;
  /** Last day it applies, inclusive. Absent: still in force. */
  readonly validTo?: string;
  readonly status: ParameterStatus;
  /** Where the value comes from: the text, the notice, the page consulted. */
  readonly source: string;
  readonly verifiedBy?: string;
  readonly verifiedOn?: string;
}

export interface DecimalParameter extends ParameterBase {
  readonly type: 'decimal';
  /** A decimal string, never a float: "0.0448", "6000.00". */
  readonly value: string;
}

/** Bands by a threshold: the row with the largest `from` not above x wins. */
export interface BandParameter extends ParameterBase {
  readonly type: 'bands';
  readonly rows: readonly { readonly from: string; readonly rate: string }[];
}

/**
 * A progressive scale written the way tax tables are: up to `upTo`, tax is
 * x × rate − deduct. The last row has no `upTo`.
 */
export interface BracketParameter extends ParameterBase {
  readonly type: 'brackets';
  readonly rows: readonly { readonly upTo?: string; readonly rate: string; readonly deduct: string }[];
}

export type Parameter = DecimalParameter | BandParameter | BracketParameter;

/** What kind of line a wage type makes. */
export const WAGE_TYPE_CLASSES = ['earning', 'deduction', 'employer', 'info', 'net'] as const;
export type WageTypeClass = (typeof WAGE_TYPE_CLASSES)[number];

export interface WageType {
  readonly code: string;
  readonly label: Localised;
  readonly class: WageTypeClass;
  /**
   * The cumulations this line adds to, with a sign: { GROSS: 1, SOCIAL: 1 }.
   * A later formula reads them with base('GROSS').
   */
  readonly bases?: Readonly<Record<string, 1 | -1>>;
  /** Show it on the payslip. Info lines (taxable income) may be shown too. */
  readonly payslip?: { readonly section: string; readonly order: number; readonly showZero?: boolean };
  /** Who owns it: the pack (statutory, locked) or the tenant (company element). */
  readonly owner?: 'pack' | 'tenant';
  readonly glKey?: string;
}

/**
 * How a company element is treated for tax and social security. The pack
 * defines the classes; a tenant's own wage type must pick one (spec §11).
 */
export interface TreatmentClass {
  readonly code: string;
  readonly label: Localised;
  /** The cumulations the amount joins. */
  readonly bases: Readonly<Record<string, 1 | -1>>;
  /**
   * For an exempt-within-a-ceiling element: the parameter holding the ceiling,
   * the bases the exempt part joins (instead of `bases`), and the bases of the
   * part above the ceiling.
   */
  readonly exemption?: {
    readonly ceilingParam: string;
    readonly exemptBases: Readonly<Record<string, 1 | -1>>;
    readonly excessBases: Readonly<Record<string, 1 | -1>>;
  };
  readonly class: 'earning' | 'deduction';
}

/** One step of the calculation schema, in order. */
export type SchemaStep =
  | {
      readonly id: string;
      readonly kind: 'line';
      readonly wageType: string;
      /** Formula for the amount; rounded to the currency's minor units. */
      readonly amount: string;
      /** Optional formulas shown on the payslip: base, rate, quantity. */
      readonly base?: string;
      readonly rate?: string;
      readonly quantity?: string;
      /** Skip the step when this is false. */
      readonly when?: string;
      /** Keep a zero line (an info line the declarations need). */
      readonly keepZero?: boolean;
      readonly note?: string;
    }
  | {
      readonly id: string;
      readonly kind: 'variables';
      /** Insert here the run's company elements of these treatment classes. */
      readonly treatmentClasses: readonly string[];
      readonly note?: string;
    };

/** A check run before calculating (spec §11, pre-run checks). */
export interface PackCheck {
  readonly id: string;
  readonly level: 'block' | 'warn' | 'info';
  /** True means the problem is there. */
  readonly when: string;
  readonly message: Localised;
}

/** What the run must supply for each employee. */
export interface InputDefinition {
  readonly key: string;
  readonly label: Localised;
  /** Used when the run does not send it. Absent: the input is mandatory. */
  readonly default?: string;
}

export interface PayrollSection {
  readonly inputs: readonly InputDefinition[];
  readonly parameters: readonly Parameter[];
  readonly wageTypes: readonly WageType[];
  readonly treatmentClasses: readonly TreatmentClass[];
  readonly schema: readonly SchemaStep[];
  readonly checks: readonly PackCheck[];
}

export interface HolidayDefinition {
  /** "MM-DD" for a fixed holiday, or a full date for one year (lunar ones). */
  readonly date: string;
  readonly label: Localised;
  /** A religious date announced late: estimated until confirmed. */
  readonly estimated?: boolean;
  readonly days?: number;
  readonly note?: string;
}

export interface LeaveTypeDefinition {
  readonly code: string;
  readonly label: Localised;
  readonly category: string;
  readonly paid: boolean;
  /** Days granted per event or per year; the tenant may only raise it (FLOOR). */
  readonly days?: string;
  readonly unit: 'days' | 'weeks' | 'hours';
  readonly requiresDocument?: boolean;
  readonly reference?: string;
  readonly status: ParameterStatus;
}

export interface FieldDefinition {
  readonly key: string;
  readonly label: Localised;
  readonly appliesTo: 'employee' | 'employer';
  readonly pattern?: string;
  readonly mandatory?: boolean;
  readonly sensitive?: boolean;
  readonly status: ParameterStatus;
}

export interface CountryPack {
  readonly format: 'cpeople-country-pack/1';
  readonly manifest: PackManifest;
  readonly fields?: readonly FieldDefinition[];
  readonly holidays?: readonly HolidayDefinition[];
  readonly leaveTypes?: readonly LeaveTypeDefinition[];
  /** Absent for a placeholder: HR works, payroll stays off (spec P4). */
  readonly payroll?: PayrollSection;
}

/**
 * Whether payroll may run for a pack in an environment (spec §7, CP-PCK-004).
 * A prototype calculates in Dev & Test only, with a SPECIMEN watermark.
 */
export function payrollAllowed(pack: CountryPack, environment: 'local' | 'dev' | 'test' | 'prod'): {
  readonly allowed: boolean;
  readonly specimen: boolean;
  readonly reason?: string;
} {
  if (!pack.payroll) return { allowed: false, specimen: false, reason: 'The pack has no payroll section.' };
  const status = pack.manifest.status;
  if (status === 'validated' || status === 'released') return { allowed: true, specimen: false };
  if (status === 'prototype' && environment !== 'prod') return { allowed: true, specimen: true };
  return {
    allowed: false,
    specimen: false,
    reason: `Pack ${pack.manifest.country} ${pack.manifest.version} is "${status}": payroll is not allowed in ${environment}.`,
  };
}
