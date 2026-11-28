import type { Messages } from '@cpeople/shared';

/**
 * What `GET /api/leave/settings` answers (HR-02 / M08).
 *
 * The same shape as the API's DTOs, kept beside the fetch like every other
 * contract in this application.
 */
export interface LeaveRule {
  readonly id: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly entitlementDays?: number;
  readonly accrualPerMonth?: number;
  readonly carryOverMaxDays?: number;
  readonly minNoticeDays: number;
  readonly maxBackdateDays: number;
  readonly note?: string;
  readonly confirmed: boolean;
}

export interface LeaveType {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly paid: boolean;
  readonly requiresDocument: boolean;
  readonly dayBasis: 'working' | 'calendar';
  readonly allowsHalfDays: boolean;
  readonly requiresSecondApproval: boolean;
  readonly tracksBalance: boolean;
  readonly active: boolean;
  readonly rule?: LeaveRule;
  readonly rules: readonly LeaveRule[];
}

export interface WorkWeek {
  readonly id: string;
  readonly site: { readonly id: string; readonly code: string; readonly name: string };
  readonly workingDays: readonly number[];
  readonly effectiveFrom: string;
  readonly note?: string;
  readonly confirmed: boolean;
}

export interface PublicHoliday {
  readonly id: string;
  readonly date: string;
  readonly name: string;
  readonly countryCode: string;
  readonly confirmed: boolean;
  readonly note?: string;
}

export interface LeavePolicy {
  readonly teamOffWarningPercent: number;
  readonly leaveYearStart: string;
  /** Who approves after the line manager (M09; HR-02 decision 1). */
  readonly secondApprover: 'manager_of_manager' | 'hr';
  readonly note?: string;
  readonly hrEmail?: string;
}

export interface LeaveSettings {
  readonly types: readonly LeaveType[];
  readonly workWeeks: readonly WorkWeek[];
  readonly holidays: readonly PublicHoliday[];
  readonly holidayYears: readonly number[];
  readonly year: number;
  readonly yearComplete: boolean;
  readonly completeYears: readonly number[];
  readonly policy: LeavePolicy;
  readonly today: string;
  readonly mayManage: boolean;
}

/** The tabs of the set-up screen, each with its own address. */
export const LEAVE_TABS = ['types', 'rules', 'week', 'holidays', 'policy'] as const;
export type LeaveTab = (typeof LEAVE_TABS)[number];

export function readLeaveTab(raw: string | string[] | undefined): LeaveTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (LEAVE_TABS as readonly string[]).includes(value ?? '') ? (value as LeaveTab) : 'types';
}

export function leaveSettingsHref(tab: LeaveTab, year?: number): string {
  const query = new URLSearchParams();

  if (tab !== 'types') query.set('tab', tab);
  if (year !== undefined) query.set('year', String(year));

  const text = query.toString();
  return text === '' ? '/settings/leave' : `/settings/leave?${text}`;
}

/**
 * What to call a leave type.
 *
 * The seven the seed knows are translated properly; anything the client adds
 * later shows the name it was given, in whatever language they typed it. A
 * screen that invented an English name for "Congé de mariage" would be worse
 * than one that shows what somebody actually wrote.
 */
export function leaveTypeName(type: { code: string; name: string }, t: Messages): string {
  const known = t.leaveTypes as Record<string, string | undefined>;
  return known[type.code] ?? type.name;
}
