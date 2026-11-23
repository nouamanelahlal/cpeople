import type { Messages } from '@cpeople/shared';

/**
 * What the leave API answers (M09 / HR-04).
 *
 * The same shapes as the API's DTOs, kept beside the fetch like every other
 * contract in this application.
 */
export type LeaveStatus =
  | 'pending_n1'
  | 'pending_n2'
  | 'pending_hr'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'cancellation_pending'
  | 'cancelled';

export type DayPart = 'full' | 'morning' | 'afternoon';

export interface LeaveWarning {
  readonly kind: 'holidays' | 'balance' | 'teamOff' | 'notice' | 'backdate';
  readonly values: Record<string, string>;
}

export interface LeaveDay {
  readonly date: string;
  readonly part: DayPart;
  readonly days: number;
  readonly reason?: 'weekend' | 'holiday';
}

export interface LeaveRequest {
  readonly id: string;
  readonly status: LeaveStatus;
  readonly employee: { readonly id: string; readonly name: string; readonly department: string };
  readonly leaveType: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly requiresDocument: boolean;
  };
  readonly from: string;
  readonly to: string;
  readonly fromPart: DayPart;
  readonly toPart: DayPart;
  readonly dayCount: number;
  readonly reason?: string;
  readonly waitingOn?: { readonly id?: string; readonly name: string };
  readonly submittedAt: string;
  readonly decidedAt?: string;
  readonly recalculatedAt?: string;
  readonly recalculatedFrom?: number;
  readonly mine: boolean;
  readonly mayDecide: boolean;
  readonly wouldOverride: boolean;
  readonly mayWithdraw: boolean;
  readonly warnings: readonly LeaveWarning[];
}

export interface LeaveCalculation {
  readonly id: string;
  readonly kind: 'submitted' | 'approved' | 'recalculated' | 'accepted';
  readonly dayCount: number;
  readonly days: readonly LeaveDay[];
  readonly dayBasis: 'working' | 'calendar';
  readonly workingDays: readonly number[];
  readonly leaveRuleId?: string;
  readonly workWeekId?: string;
  readonly holidayIds: readonly string[];
  readonly holidaysComplete: boolean;
  readonly note?: string;
  readonly at: string;
}

export interface LeaveDecision {
  readonly id: string;
  readonly kind: string;
  readonly byName: string;
  readonly byRole: string;
  readonly reason?: string;
  readonly at: string;
}

export interface LeaveRequestDetail extends LeaveRequest {
  readonly calculations: readonly LeaveCalculation[];
  readonly decisions: readonly LeaveDecision[];
  readonly holidays: readonly { readonly id: string; readonly date: string; readonly name: string }[];
}

export interface LeaveReviewItem {
  readonly request: LeaveRequest;
  readonly agreed: number;
  readonly now: number;
  readonly because: 'holidays' | 'week' | 'rule' | 'unknown';
  readonly pending: boolean;
}

export interface LeaveList {
  readonly requests: readonly LeaveRequest[];
  readonly review: readonly LeaveReviewItem[];
  readonly counts: Record<string, number>;
  readonly tabs: readonly string[];
  readonly today: string;
  readonly mayRequest: boolean;
}

export interface LeaveOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly allowsHalfDays: boolean;
  readonly requiresDocument: boolean;
  readonly dayBasis: 'working' | 'calendar';
  readonly requiresSecondApproval: boolean;
}

export interface LeavePreview {
  readonly dayCount: number;
  readonly days: readonly LeaveDay[];
  readonly dayBasis: 'working' | 'calendar';
  readonly siteName?: string;
  readonly warnings: readonly LeaveWarning[];
  readonly blocked?: { readonly kind: string; readonly values: Record<string, string> };
}

/** The tabs, each with its own address so a link can open the right one. */
export const LEAVE_TABS = ['mine', 'approvals', 'all', 'review'] as const;
export type LeaveTab = (typeof LEAVE_TABS)[number];

export function readLeaveTab(raw: string | string[] | undefined): LeaveTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (LEAVE_TABS as readonly string[]).includes(value ?? '') ? (value as LeaveTab) : 'mine';
}

export function leaveHref(tab: LeaveTab): string {
  return tab === 'mine' ? '/leave' : `/leave?tab=${tab}`;
}

/**
 * What to call a leave type.
 *
 * The seeded codes are translated; anything the client adds later shows the name
 * it was given, in whatever language they typed it.
 */
export function leaveTypeName(type: { code: string; name: string }, t: Messages): string {
  const known = t.leaveTypes as Record<string, string | undefined>;
  return known[type.code] ?? type.name;
}

/** Swaps {name} and friends for their values. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/**
 * A warning in the reader's own language.
 *
 * The API sends what happened and the numbers; the sentence is built here,
 * because the sentence is a matter of translation and the fact is not.
 */
export function warningText(warning: LeaveWarning, t: Messages): string {
  const w = t.leave.warnings;

  switch (warning.kind) {
    case 'holidays':
      return fill(w.holidays, warning.values);
    case 'balance':
      return fill(warning.values['own'] === 'true' ? w.balanceOwn : w.balance, warning.values);
    case 'teamOff':
      return fill(w.teamOff, warning.values);
    case 'notice':
      return fill(w.notice, warning.values);
    case 'backdate':
      return w.backdate;
    default:
      return '';
  }
}

/**
 * Reads a refusal back out of the address.
 *
 * The server action puts the API's named reason — and the numbers its sentence
 * needs — in the query string, so that the page can say it in the reader's
 * language rather than showing whatever English the API happened to use.
 */
export function readRefusal(raw: string | string[] | undefined): {
  kind: string;
  values: Record<string, string>;
} | null {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return null;

  const [kind, rest] = text.split('~');

  const values = Object.fromEntries(
    (rest ?? '')
      .split('|')
      .filter((pair) => pair !== '')
      .map((pair) => {
        const at = pair.indexOf(':');
        return at === -1 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
      }),
  );

  return { kind: kind ?? 'failed', values };
}

/**
 * A refusal, worded for the reader.
 *
 * Dates inside it are formatted the way the rest of the screen formats dates:
 * "7 Dec 2026" rather than the 2026-12-07 the API quite rightly sends.
 */
export function refusalText(
  refusal: { kind: string; values: Record<string, string> },
  t: Messages,
  dateMedium?: (iso: string) => string,
): string {
  const errors = t.leave.errors as Record<string, string | undefined>;
  const template = errors[refusal.kind] ?? errors['failed'] ?? '';

  const values = dateMedium
    ? Object.fromEntries(
        Object.entries(refusal.values).map(([key, value]) => [
          key,
          value.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dateMedium(iso)),
        ]),
      )
    : refusal.values;

  return fill(template, values);
}
