import type { NamedCode } from './employee-list';

/**
 * One employee's file, as `GET /api/employees/:id` answers it (HR-01 spec 6.3).
 *
 * `sensitive` is there or it is not: a reader who may not see pay, identifiers,
 * address, birth date or dependents never receives them, and `masked` names what
 * was withheld so the file can still show that those fields exist.
 */
export interface Dependent {
  readonly id: string;
  readonly relation: string;
  readonly firstName: string;
  readonly birthDate: string;
}

export interface SensitiveEmployee {
  readonly birthDate: string;
  readonly nationalId: string;
  readonly address?: string;
  readonly baseSalaryMinor: number;
  readonly salaryCurrency: string;
  readonly socialSecurityNumber?: string;
  readonly bankName?: string;
  readonly bankAccount?: string;
  readonly dependents: readonly Dependent[];
}

export interface ContractSummary {
  readonly id: string;
  readonly type: NamedCode;
  readonly status: 'draft' | 'generated' | 'signed' | 'renewed' | 'ended';
  readonly startDate: string;
  readonly endDate?: string;
  readonly trialEndDate?: string;
  readonly salaryMinor?: number;
  readonly salaryCurrency?: string;
}

export interface EmployeeFile {
  readonly id: string;
  readonly employeeNumber: string;
  readonly status: 'onboarding' | 'active' | 'left';
  readonly firstName: string;
  readonly lastName: string;
  readonly gender: string;
  readonly nationality: string;
  readonly maritalStatus: string;
  readonly phone?: string;
  readonly email?: string;
  readonly position: NamedCode;
  readonly department: NamedCode;
  readonly site?: NamedCode;
  readonly costCentre?: NamedCode;
  readonly costCentreOverride: boolean;
  readonly manager?: { readonly id: string; readonly name: string };
  readonly hireDate: string;
  readonly seniorityDate: string;
  readonly seniorityMonths: number;
  readonly leftOn?: string;
  readonly pensionMember: boolean;
  readonly sensitive?: SensitiveEmployee;
  readonly masked: readonly string[];
  readonly contracts: readonly ContractSummary[];
  readonly documentCount: number;
  readonly today: string;
  readonly can: {
    readonly edit: boolean;
    readonly editOwnContact: boolean;
    readonly seeSensitive: boolean;
    readonly seeHistory: boolean;
  };
}

export interface AuditDiff {
  readonly field: string;
  readonly from: string;
  readonly to: string;
  readonly masked: boolean;
}

export interface AuditEvent {
  readonly id: string;
  readonly at: string;
  readonly actorName?: string;
  readonly actorRole?: string;
  readonly action: string;
  readonly summary: string;
  readonly diff: readonly AuditDiff[];
}

/** The tabs of a file, in the order the spec puts them (6.3). */
export const TABS = ['overview', 'job', 'pay', 'family', 'contracts', 'history'] as const;
export type Tab = (typeof TABS)[number];

export function readTab(raw: string | string[] | undefined): Tab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TABS as readonly string[]).includes(value ?? '') ? (value as Tab) : 'overview';
}

/** The address of one tab of one file, with or without the edit form open. */
export function tabHref(id: string, tab: Tab, options: { edit?: boolean } = {}): string {
  const query = new URLSearchParams();
  if (tab !== 'overview') query.set('tab', tab);
  if (options.edit) query.set('edit', '1');

  const text = query.toString();
  return text === '' ? `/employees/${id}` : `/employees/${id}?${text}`;
}

/** Seniority as a sentence takes years and months, not a count of months. */
export function seniorityParts(months: number): { years: number; months: number } {
  return { years: Math.floor(months / 12), months: months % 12 };
}
