import type { Messages } from '@cpeople/shared';

/**
 * What the attendance screens read (M10 / HR-04, build spec §5).
 *
 * The shapes are the API's, written once here so the page, the wizard and the
 * exception list all read the same thing. Nothing is computed in this file: a
 * worked day is derived by the API from the punches and the rules it was built
 * with, and a second opinion in the browser is exactly how two numbers start
 * disagreeing.
 */
export interface ImportProblemRow {
  readonly line: number;
  readonly kind: 'notATime' | 'noNumber' | 'noColumns';
  readonly value: string;
}

export interface UnknownNumber {
  readonly employeeNumber: string;
  readonly punches: number;
  /** The employee this looks like, where one does: "0107" is probably 107. */
  readonly suggestion?: { id: string; name: string; employeeNumber: string };
}

export interface ImportReport {
  readonly importId: string;
  readonly fileName: string;
  readonly from?: string;
  readonly to?: string;
  readonly rows: number;
  readonly matched: number;
  readonly unknown: number;
  readonly duplicates: number;
  readonly daysBuilt: number;
  readonly problems: ImportProblemRow[];
  readonly unknownNumbers: UnknownNumber[];
  readonly exceptionsByCode: { code: string; count: number }[];
  /** Days already in the period that were corrected by hand, and will be kept. */
  readonly manualDaysKept: number;
  readonly applied: boolean;
}

/** The refusal the action carried in the address, in the reader's language. */
export function importRefusalText(kind: string, t: Messages): string {
  const errors = t.attendance.import.errors as Record<string, string | undefined>;
  return errors[kind] ?? errors['failed'] ?? kind;
}

/** Why a line could not be read, in the reader's language. */
export function problemText(kind: string, t: Messages): string {
  const reasons = t.attendance.import.reasons as Record<string, string | undefined>;
  return reasons[kind] ?? kind;
}

/** What an exception code means, in the reader's language. */
export function exceptionText(code: string, t: Messages): string {
  const codes = t.attendance.exceptions.codes as Record<string, string | undefined>;
  return codes[code] ?? code;
}

/** One thing the device could not explain, as the screen needs it. */
export interface ExceptionRow {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly detail?: string;
  readonly date?: string;
  readonly employee?: { id: string; name: string; employeeNumber: string; department?: string };
  readonly workedMin?: number;
  readonly overtimeMin?: number;
  readonly recoveryMin?: number;
  readonly resolutions: Resolution[];
  readonly resolution?: string;
  readonly comment?: string;
  readonly resolvedBy?: string;
  readonly resolvedAt?: string;
}

export type Resolution =
  | 'map'
  | 'ignore'
  | 'addPunch'
  | 'unpaidAbsence'
  | 'confirmOvertime'
  | 'convertToRecovery'
  | 'undoRecovery'
  | 'confirm';

export interface ExceptionList {
  readonly groups: { code: string; open: number; resolved: number }[];
  readonly rows: ExceptionRow[];
  readonly departments: { id: string; name: string }[];
  readonly mayCorrect: boolean;
  /** `team` where the reader is a manager, which the screen says out loud. */
  readonly scope: 'all' | 'team';
  readonly total: number;
}

/** Why an answer was refused, in the reader's language. */
export function exceptionRefusalText(kind: string, t: Messages, values: Record<string, string> = {}): string {
  const errors = t.attendance.exceptions.errors as Record<string, string | undefined>;
  const template = errors[kind] ?? errors['failed'] ?? kind;

  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}
